# 학습 환경의 아키텍처 (Dynamic Workers)

브라우저에서 사용자가 작성한 임의의 코드를 안전하게 실행하는 샌드박스를 구축하려면, 기존에는 무거운 Docker 컨테이너를 백엔드에서 돌리는 것이 일반적이었다. 하지만 컨테이너 방식에서는 실행 시마다 수 초의 부팅 지연이 발생하며, 서버 인스턴스의 유지비도 늘어난다.

이 학습 환경에서는 컨테이너를 일절 사용하지 않고 **Dynamic Workers(Worker Loader 바인딩)**를 채택하고 있다. 부모 Worker가 수신한 요청에 따라, 온디맨드로 자식 V8 isolate를 메모리 상에 구축하고 밀리초 단위로 일회성으로 사용한다.

## 동적 Worker의 구축 및 기동

부모 Worker는 사용자가 전송한 코드를 모듈로 묶고, `env.LOADER`를 통해 자식 Worker를 인스턴스화한다.

```ts
const worker = env.LOADER.get(`sandbox-${hash(code)}`, () => ({
  compatibilityDate: "2026-02-24",
  mainModule: "index.js",
  modules: { "index.js": wrapUserCode(code) },
  env: { KV: kvProxyStub, DB: env.DB },
  globalOutbound: null, // 외부 네트워크로의 모든 외부 통신 차단
  limits: { cpuMs: 100, subRequests: 0 },
}));

const response = await worker.getEntrypoint().fetch(new Request("https://sandbox.internal/"));
```

- **`globalOutbound: null`을 통한 완전 격리**: 자식 Worker 내부에서는 인터넷상의 임의의 서버를 향한 `fetch()`나 Raw 소켓 설정이 일절 불가능하다. 악의적인 스크립트에 의한 부정 외부 통신이나 자격 증명 유출을 물리적으로 차단한다.
- **엄격한 리소스 상한**: CPU 실행 시간을 최대 100ms로 제한한다. 무한 루프나 과도한 연산을 포함하는 코드가 투입되더라도, 부모 Worker의 리소스를 고갈시키지 않고 자식 isolate만 종료된다.
- **isolate의 캐시 재사용**: `env.LOADER.get(id, factory)`를 사용하여 동일한 코드(해시값이 일치하는 코드)에 대해서는 기존 isolate를 재사용한다. 불필요한 메모리 재할당을 방지하여 비용과 지연 시간을 최소화한다.

## 바인딩의 인젝션 경계

자식 Worker의 `env`에 직접 전달할 수 있는 객체에는 제한이 있다. 구조화 클론(Structured Clone)이 가능한 데이터 타입 및 Service Binding으로 한정된다.

| 리소스          | 자식 Worker로 전달하는 방법                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| D1 데이터베이스 | 네이티브로 구조화 클론을 지원하므로 그대로 전달                                                                 |
| Durable Objects | `namespace.get(id)`로 가져온 스텁 객체(Service Binding)로 전달                                                  |
| KV / R2 / AI    | 이름 공간 자체는 직접 클론할 수 없으므로, 부모 측에서 Durable Object나 Service Binding의 RPC 프록시를 통해 중계 |

예를 들어 KV의 경우, 부모 환경에 배치한 Durable Object가 `get` / `put` / `delete` / `list` 핸들러를 담당하고, 그 RPC 스텁을 자식 환경으로 `env.KV`로 인젝션한다. 자식 Worker 내부의 코드에서는 실제 KV 이름 공간과 완전히 동일한 인터페이스로 투명하게 이용할 수 있다.

## 멀티테넌트 실행의 방어선

1. **암묵적 캐시 오염 방지**: 코드 내의 공백이나 줄 바꿈을 정규화한 후 해시값을 계산하여, 의도치 않은 캐시 분할을 방지한다.
2. **레이트 리밋을 통한 과부하 방지**: 실행 엔드포인트의 호출 횟수를 클라이언트 IP별로 제한하고(컨테이너는 더 엄격하게 제한한다), 자동화 스크립트에 의한 과부하 공격을 방지한다. 상한은 Cloudflare 로케이션별로 집계하는 대략적인 값이다.
3. **비용 방벽**: Dynamic Workers는 '하루에 생성된 고유 Worker 수'에 따라 과금된다. 교재 코드의 초기 상태를 많은 사용자가 공유함으로써, 과금 대상인 고유 Worker 수를 최소한으로 억제하는 설계를 채택하고 있다.
