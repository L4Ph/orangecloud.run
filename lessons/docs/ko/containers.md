# Containers(컨테이너 실행 환경)

V8 isolate는 밀리초 단위로 부팅되며, 수천 건의 요청을 경쾌하게 처리한다. 하지만 FFmpeg으로 동영상을 트랜스코딩하고 싶을 때, Playwright로 헤드리스 브라우저를 구동하고 싶을 때, 혹은 C 언어로 작성된 거대한 바이너리를 실행하고 싶을 때, isolate의 벽에 가로막힌다. OS의 커널 기능도, 임의 파일의 실행 권한도 그곳에는 존재하지 않기 때문이다.

Cloudflare Containers는 isolate로는 도저히 해결할 수 없는 과제에 대한 **최후의 수단**이다. 자체 Docker 이미지를 그대로 에지로 배포하고, Durable Objects 뒤에서 필요에 따라 완전한 Linux 컨테이너를 기동 및 중지한다.

## isolate와 컨테이너의 트레이드오프

| 비교 항목 | V8 isolate(Dynamic Workers) | Cloudflare Containers |
| --- | --- | --- |
| 부팅 시간 | 수 밀리초(즉시 응답 시작) | 수 초 단위(컨테이너 부팅 대기) |
| 메모리 상한 | 128MB ~(경량 설계) | 기가바이트 단위로 확보 가능 |
| 실행 가능 파일 | JS, TS, Wasm, Pyodide | 임의의 Linux 실행 파일, 공유 라이브러리 |
| 과금 단위 | 실행 CPU 시간 | 컨테이너 부팅 시간(vCPU 분·GiB 시간) |

Web API 요청을 중개하는 것뿐이라면 isolate가 압도적으로 빠르고 비용도 저렴하다. **먼저 Workers 단독으로 구현할 수 없는지 철저히 고민하고, 정말로 불가능할 때만 컨테이너를 도입한다**는 것이 에지 설계의 철칙이다.

## Sandbox SDK를 통한 컨테이너 제어

코드에서 컨테이너를 조작할 때는 Cloudflare의 Sandbox SDK(`@cloudflare/sandbox`)를 이용한다. Worker 내부에서 온디맨드로 컨테이너 인스턴스를 호출하여 셸 명령어를 실행하거나 포트를 노출할 수 있다.

```ts
import { getSandbox } from '@cloudflare/sandbox';

// 사용자 ID나 세션마다 독립된 샌드박스 확보
const sandbox = await getSandbox(env.SANDBOX, 'user-session-123');

// 컨테이너 내부에서 명령어를 실행하고 표준 출력을 받음
const result = await sandbox.run('node --version');
console.log('Container Node.js:', result.stdout);
```

컨테이너는 요청이 끊기면 자동으로 슬립 상태로 전환되며, 활성하게 이용되는 시간만 과금 대상이 된다.
