# Containers(컨테이너 실행 환경)

V8 isolate는 밀리초 단위로 부팅되며, 대량의 요청을 경쾌하게 처리한다. 하지만 FFmpeg으로 동영상을 트랜스코딩하고 싶을 때, 혹은 C 언어로 작성된 거대한 바이너리를 실행하고 싶을 때, isolate의 벽에 가로막힌다. OS의 커널 기능도, 임의 파일의 실행 권한도 그곳에는 존재하지 않기 때문이다.

Cloudflare Containers는 isolate로는 도저히 해결할 수 없는 과제에 대한 **최후의 수단**이다. 자체 Docker 이미지를 그대로 에지로 배포하고, Durable Objects 뒤에서 필요에 따라 완전한 Linux 컨테이너를 기동 및 중지한다.

## isolate와 컨테이너의 트레이드오프

| 비교 항목      | V8 isolate(Workers)         | Cloudflare Containers                                    |
| -------------- | --------------------------- | -------------------------------------------------------- |
| 부팅 시간      | 밀리초 단위(즉시 응답 시작) | 수 초 단위(컨테이너 부팅 대기)                           |
| 메모리 상한    | 128MB(경량 설계)            | 256MiB ~ 12GiB(인스턴스 타입으로 선택)                   |
| 실행 가능 파일 | JS, TS, Wasm, Pyodide       | 임의의 Linux 실행 파일, 공유 라이브러리                  |
| 과금 단위      | 실행 CPU 시간과 요청 수     | 실행 중 10ms마다(메모리·디스크는 할당량, CPU는 실사용량) |

Web API 요청을 중개하는 것뿐이라면 isolate가 부팅이 빠르고 리소스 효율성도 뛰어나다. **먼저 Workers 단독으로 구현할 수 없는지 철저히 고민하고, 정말로 불가능할 때만 컨테이너를 도입한다**는 것이 에지 설계의 철칙이다.

## Durable Object를 통한 컨테이너 제어

코드에서 컨테이너를 조작할 때는 Durable Object의 `this.ctx.container`를 사용한다. Durable Object가 `start()`로 컨테이너를 기동하고, `exec()`로 명령어를 실행하며, `getTcpPort()`로 포트에 연결한다. `@cloudflare/sandbox`(1.0 이후)는 `Files` 같은 보조 클래스만 제공한다.

```ts
import { DurableObject } from "cloudflare:workers";

// cloudflare.config.ts의 defineContainer에서 schedulingPolicy를 "durable-object"로 하고,
// images.default에 Dockerfile을 선언해 둔다
export class Sandbox extends DurableObject {
  async nodeVersion() {
    const container = this.ctx.container;
    if (!container) throw new Error("컨테이너가 설정되어 있지 않다");

    if (!container.running) {
      container.start({
        image: container.images.default,
        entrypoint: ["sleep", "infinity"], // 메인 프로세스가 끝나면 컨테이너도 멈춘다
        enableInternet: false,
      });
    }
    await container.setInactivityTimeout(10 * 60 * 1000);

    // 컨테이너 내부에서 명령어를 실행하고 표준 출력을 받음
    const process = await container.exec(["node", "--version"]);
    const { stdout } = await process.output();
    return new TextDecoder().decode(stdout).trim();
  }
}

export default {
  async fetch(request: Request, env: { SANDBOX: DurableObjectNamespace<Sandbox> }) {
    // 사용자 ID나 세션마다 독립된 샌드박스 확보
    const sandbox = env.SANDBOX.getByName("user-session-123");
    return new Response(`Container Node.js: ${await sandbox.nodeVersion()}`);
  },
};
```

컨테이너는 Durable Object가 비활성 상태가 된 뒤 `setInactivityTimeout()`으로 지정한 시간(최대 6시간)이 지나면 중지된다. 실행 중에는 유휴 상태여도 메모리와 디스크가 과금되며, 중지되면 디스크의 내용은 사라진다. Containers는 Workers Paid 플랜에서 사용할 수 있다.
