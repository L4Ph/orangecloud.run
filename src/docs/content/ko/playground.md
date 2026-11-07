# 학습 환경의 아키텍처 (Dynamic Workers)

브라우저에서 사용자가 작성한 임의의 코드를 안전하게 실행하는 샌드박스를 구축하려면, 기존에는 무거운 Docker 컨테이너를 백엔드에서 돌리는 것이 일반적이었다. 하지만 컨테이너 방식에서는 실행 시마다 수 초의 부팅 지연이 발생하며, 서버 인스턴스의 유지비도 늘어난다.

이 학습 환경의 JavaScript와 Python 레슨은 컨테이너를 사용하지 않고 **Dynamic Workers(Worker Loader 바인딩)**로 실행한다. 부모 Worker가 수신한 요청에 따라, 온디맨드로 자식 V8 isolate를 메모리 상에 구축하고 밀리초 단위로 일회성으로 사용한다. Containers 장들과 Durable Object를 직접 작성하는 장은 컨테이너와 Durable Object라는 다른 런타임에서 실행한다.

## 동적 Worker의 구축 및 기동

부모 Worker는 사용자가 전송한 코드를 결과를 항상 JSON으로 반환하는 래퍼와 함께 모듈로 묶고, `env.LOADER`를 통해 자식 Worker를 인스턴스화한다.

```ts
import { exports } from "cloudflare:workers";

// ID는 래퍼 버전과 정규화한 코드의 SHA-256(앞 128비트)으로 만든다
const id = `run-${WRAPPER_VERSION}-${await hash(normalize(code))}`;
const worker = env.LOADER.get(id, () => ({
  compatibilityDate: "2026-02-24",
  mainModule: "index.js",
  modules: { "index.js": wrapped, "user.js": code },
  env: {
    KV: exports.LessonKv({ props: { prefix: "playground/" } }),
    STORAGE: exports.LessonR2({ props: { prefix: "playground/" } }),
    AI: exports.LessonAi({ props: {} }),
    COUNTER: exports.LessonCounter({ props: {} }),
    DB: exports.LessonDb({ props: {} }),
  },
  globalOutbound: null, // 외부 네트워크로의 모든 외부 통신 차단
  limits: { cpuMs: 100, subRequests: 20 },
}));

const response = await worker.getEntrypoint().fetch(new Request("https://sandbox.internal/"));
```

- **`globalOutbound: null`을 통한 네트워크 차단**: 자식 Worker에서 `fetch()`와 `connect()`(TCP 연결)는 모두 예외가 발생한다. 외부와의 통신 경로는 부모가 전달한 다섯 개의 스텁뿐이므로, 악의적인 스크립트에 의한 부정한 외부 통신을 막을 수 있다.
- **리소스 상한**: CPU 실행 시간을 최대 100ms로 제한한다. 무한 루프나 과도한 연산을 포함하는 코드가 투입되더라도, 상한에 도달한 자식 Worker는 즉시 예외를 던진다.
- **isolate의 캐시 재사용**: `env.LOADER.get(id, factory)`는 ID로 isolate를 캐시한다. 같은 ID이면 기존 isolate가 재사용될 수 있지만 보장되지는 않는다. 이미 로드된 Worker는 코드를 대조하지 않고 재사용되므로, ID는 정규화한 코드의 SHA-256(앞 128비트)으로 만들어 다른 코드가 같은 ID가 되지 않도록 한다.
- **호환 날짜 고정**: 이 에디터의 Worker는 호환 날짜 2026-02-24, `nodejs_compat` 없이 동작하므로 `process`는 존재하지 않는다.

## 바인딩의 인젝션 경계

자식 Worker의 `env`에 실을 수 있는 것은 구조화 클론(Structured Clone)이 가능한 데이터 타입과 Service Binding 두 가지뿐이다. D1, KV, R2, AI, Durable Object 스텁은 어느 쪽에도 해당하지 않으므로 직접 전달할 수 없다. `env`에 실으면 `DataCloneError`로 실패한다.

그래서 부모 Worker는 바인딩마다 `WorkerEntrypoint` 클래스를 export하고, 그 스텁(`exports.LessonKv({ props })`)을 자식에게 전달한다. 자식은 `env.KV.get()`처럼 일반 바인딩으로 호출할 수 있다. 호출은 부모로의 RPC가 되어, 부모가 실제 리소스에 대해 실행한다. 클래스는 `src/lib/lesson-bindings.ts`에 있다.

| 리소스          | 자식 Worker가 받는 것                                                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| KV / R2         | `LessonKv` / `LessonR2`. 키를 `props.prefix` 아래로 가두므로 앱의 다른 키에는 닿지 않는다                                                |
| D1 데이터베이스 | `LessonDb`. `prepare(sql).bind(...).run()`의 연쇄는 차례로 스텁을 반환한다. 접두사로 구분하지 않으며 모두가 같은 데이터베이스를 공유한다 |
| Workers AI      | `LessonAi`. 호출마다 과금되므로 수업용 모델 하나와 작은 입력으로 제한한다                                                                |
| Durable Objects | `LessonCounter`. Durable Object로 중계하는 스텁. 이름이 고정되어 있어 모두가 같은 카운터를 공유한다                                      |

자식에게 보이는 것은 이 다섯 개의 스텁뿐이며, 부모의 `env`나 `ctx`, 클래스에 쓰지 않은 메서드에는 닿지 않는다. Service Binding을 통한 호출은 서브리퀘스트 상한에 포함되므로 1회 실행당 20회까지로 제한한다.

## 멀티테넌트 실행의 방어선

1. **캐시 분할 방지**: CRLF를 LF로 통일하고 끝의 줄 바꿈을 제거한 뒤 해시값을 계산하여, 내용이 같은 코드가 서로 다른 Worker로 집계되는 것을 방지한다. 공백처럼 동작을 바꿀 수 있는 차이는 정규화하지 않는다.
2. **레이트 리밋을 통한 과부하 방지**: 실행 엔드포인트의 호출 횟수를 클라이언트 IP별로 제한하고(컨테이너와 Durable Object 실행은 더 엄격하게 제한한다), 자동화 스크립트에 의한 과부하 공격을 방지한다. 상한은 Cloudflare 로케이션별로 집계하는 대략적인 값이다.
3. **비용 억제**: Dynamic Workers는 하루에 생성된 고유 Worker(ID와 코드의 조합) 수에 더해 요청 수와 CPU 시간(시작 시간 포함)으로 과금된다. 유료 요금제가 필요하다. 수정하지 않은 교재 코드는 모두가 같은 Worker를 사용하므로 고유 수가 늘지 않는다. 수정한 코드는 내용이 바뀔 때마다 새로운 Worker가 되므로, IP별 레이트 리밋이 상한이 된다.
