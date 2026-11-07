# Containers (에지 컨테이너)

V8 isolate의 제약은 의도된 것이다. 파일 시스템을 점유하고, 상주 프로세스를 금지하며, 메모리를 128MB로 제한함으로써 밀리초 단위의 부팅과 수만 개의 병행 스케일링을 확보했다. 하지만 실제 워크로드에는 isolate의 경계를 넘어서는 처리가 분명히 존재한다.

FFmpeg를 이용한 동영상 인코딩, Playwright를 통한 헤드리스 브라우저 제어, C/C++로 작성된 기존 바이너리 실행, 또는 수 기가바이트의 메모리를 필요로 하는 고부하 데이터 처리. 이러한 작업들은 Linux 커널의 완전한 기능 없이는 동작하지 않는다.

Cloudflare Containers는 이러한 상황에 대한 **마지막 카드**이다. 표준 Docker 이미지를 에지 환경으로 가져와 Durable Objects의 라이프사이클 제어와 결합함으로써, 완전한 Linux 컨테이너를 온디맨드로 가동한다.

## 아키텍처 대비

| 평가 축        | V8 isolate (Workers)        | Cloudflare Containers                    |
| -------------- | --------------------------- | ---------------------------------------- |
| 부팅 지연 시간 | 1 ~ 5밀리초                 | 수 초 단위 (이미지 압축 해제·부팅)       |
| 메모리 할당    | 128MB ~                     | 여러 GiB 단위로 구성 가능                |
| 런타임 환경    | Web 표준 API, Wasm, Pyodide | 완전한 Linux (Debian, Alpine, Ubuntu 등) |
| 최적 영역      | API 라우팅, 인증, 경량 변환 | 고부하 배치, 미디어 변환, 샌드박스 실행  |

"HTTP 요청을 받아 데이터베이스를 조회하는"과 같은 전형적인 처리라면 isolate가 압도적으로 민첩하며 리소스 효율성도 뛰어나다. **모든 수단을 Workers 단독으로 모색하고, OS 네이티브 바이너리나 대량의 메모리가 필수적임이 판명되었을 때 비로소 컨테이너를 채택하는 것**이 에지 설계에서 실패를 피하는 원칙이다.

## Sandbox SDK를 통한 라이프사이클 제어

컨테이너 호출에는 Cloudflare Sandbox SDK(`@cloudflare/sandbox`)를 사용한다. Workers 측에서 프로그램을 통해 컨테이너 인스턴스의 라이프사이클을 묶고, 명령어 실행이나 내부 포트로의 터널링을 제어한다.

```ts
import { getSandbox } from "@cloudflare/sandbox";

// 세션 단위로 격리된 샌드박스 환경 식별
const sandbox = await getSandbox(env.SANDBOX, "session-456");

// 독립된 Linux 환경의 셸 상에서 명령어 실행
const execution = await sandbox.run('python3 -c "print(1 + 1)"');
console.log("stdout:", execution.stdout.trim());
```

컨테이너는 무통신 상태가 지속되면 자동으로 중지되어 CPU 리소스 소비를 최소화한다. 장시간의 아이들 상태에 대해 불필요한 과금이 발생하지 않는 구조로 되어 있다.
