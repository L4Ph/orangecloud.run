# Containers (에지 컨테이너)

V8 isolate의 제약은 의도된 것이다. 영속적인 파일 시스템을 제공하지 않고, 상주 프로세스를 금지하며, 메모리를 128MB로 제한함으로써 밀리초 단위의 부팅과 높은 병행성을 확보했다. 하지만 실제 워크로드에는 isolate의 경계를 넘어서는 처리가 분명히 존재한다.

FFmpeg를 이용한 동영상 인코딩, C/C++로 작성된 기존 바이너리 실행, 또는 수 기가바이트의 메모리를 필요로 하는 고부하 데이터 처리. 이러한 작업들은 OS의 프로세스와 파일 시스템을 전제로 한다. 헤드리스 브라우저를 제어하는 것이 전부라면, Workers에서 Playwright로 조작할 수 있는 Browser Run이 있다.

Cloudflare Containers는 이러한 상황에 대한 **최후의 수단**이다. 표준 Docker 이미지를 에지 환경으로 가져와 Durable Objects의 라이프사이클 제어와 결합함으로써, 완전한 Linux 컨테이너를 온디맨드로 가동한다.

## 아키텍처 대비

| 평가 축        | V8 isolate (Workers)        | Cloudflare Containers                            |
| -------------- | --------------------------- | ------------------------------------------------ |
| 부팅 지연 시간 | 밀리초 단위                 | 1~3초 전후 (이미지 크기와 기동 처리에 따라 다름) |
| 메모리 할당    | 128MB (상한)                | 256MiB ~ 12GiB (인스턴스 타입으로 선택)          |
| 런타임 환경    | Web 표준 API, Wasm, Pyodide | 완전한 Linux (Debian, Alpine, Ubuntu 등)         |
| 최적 영역      | API 라우팅, 인증, 경량 변환 | 고부하 배치, 미디어 변환, 샌드박스 실행          |

"HTTP 요청을 받아 데이터베이스를 조회하는"과 같은 전형적인 처리라면 isolate가 부팅이 빠르고 리소스 효율성도 뛰어나다. **모든 수단을 Workers 단독으로 모색하고, OS 네이티브 바이너리나 대량의 메모리가 필수적임이 판명되었을 때 비로소 컨테이너를 채택하는 것**이 에지 설계에서 실패를 피하는 원칙이다.

## Durable Object를 통한 라이프사이클 제어

컨테이너는 Durable Object의 `this.ctx.container`로 조작한다. Worker는 이름으로 Durable Object를 호출하고, Durable Object가 `start()`로 기동하고, `exec()`로 명령어를 실행하며, `setInactivityTimeout()`으로 중지되기까지의 시간을 정한다. `@cloudflare/sandbox`(1.0 이후)가 제공하는 것은 `Files` 같은 보조 클래스뿐이며, 컨테이너의 기동·중지·모니터링은 하지 않는다. 여기서 사용하는 `durable_object` 스케줄링 정책은 공개 베타이며, 기존의 `default` 정책은 더 이상 권장되지 않는다(deprecated).

```ts
import { DurableObject } from "cloudflare:workers";

// cloudflare.config.ts의 defineContainer에서 schedulingPolicy를 "durable-object"로 하고,
// images.default에 Dockerfile을 선언해 둔다
export class Sandbox extends DurableObject {
  async run(argv: string[]) {
    const container = this.ctx.container;
    if (!container) throw new Error("컨테이너가 설정되어 있지 않다");

    if (!container.running) {
      // start()는 준비 완료를 기다리지 않고 반환된다. exec()는 기동 중인 컨테이너를 기다린다
      container.start({
        image: container.images.default,
        instance: "lite", // 1/16 vCPU, 메모리 256 MiB
        entrypoint: ["sleep", "infinity"], // 메인 프로세스가 끝나면 컨테이너도 멈춘다
        enableInternet: false, // 외부로 나가는 통신을 허용하지 않는다
      });
    }
    // Durable Object가 비활성 상태가 된 뒤 10분이 지나면 중지된다 (최대 6시간)
    await container.setInactivityTimeout(10 * 60 * 1000);

    // exec()는 셸을 거치지 않고 인수 배열을 그대로 실행한다
    const process = await container.exec(argv);
    const { exitCode, stdout } = await process.output();
    return { exitCode, stdout: new TextDecoder().decode(stdout) };
  }
}

export default {
  async fetch(request: Request, env: { SANDBOX: DurableObjectNamespace<Sandbox> }) {
    // 세션마다 별도의 Durable Object(별도의 컨테이너)를 사용한다
    const sandbox = env.SANDBOX.getByName("session-456");
    const { stdout } = await sandbox.run(["node", "--version"]);
    return new Response(stdout);
  },
};
```

컨테이너는 Durable Object가 비활성 상태가 된 뒤 `setInactivityTimeout()`으로 지정한 시간(최대 6시간)이 지나면 중지된다. 지정하지 않으면 비활성 상태가 된 직후에 멈춘다. 과금은 10ms 단위이며, 실행 중에는 유휴 상태여도 메모리와 디스크가 할당량 그대로, CPU는 실제로 사용한 만큼만 과금된다. 중지되면 과금도 멈추지만 디스크의 내용은 사라진다. Containers는 Workers Paid 플랜에서 사용할 수 있다.
