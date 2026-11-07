# 이 사이트의 구조

지금까지 눌러 온 "실행" 버튼이 뒤에서 무엇을 하는지. 여기의 모든 것은 Cloudflare 기능만으로 만들어져 있어 그대로 자기 서비스에 옮길 수 있습니다.

## 실행할 때마다 Worker를 만든다

이 사이트는 **Dynamic Workers**를 씁니다. 부모 Worker가 `env.LOADER`(Worker Loader 바인딩)를 들고, 요청마다 자식 Worker를 조립합니다.

```ts
const worker = env.LOADER.get(`run-${hash(code)}`, () => ({
  compatibilityDate: '2026-02-24',
  mainModule: 'index.js',
  modules: { 'index.js': wrap(code) },
  env: { KV: kvStub, DB: env.DB },
  globalOutbound: null,
  limits: { cpuMs: 100, subRequests: 0 },
}));

const response = await worker.getEntrypoint().fetch(new Request('https://sandbox.internal/'));
```

- `load()`는 매번 새로, `get(id, callback)`은 id별로 isolate를 재사용
- `globalOutbound: null`로 외부 통신을 막음. `fetch`도 `connect`도 실패
- `limits`로 CPU와 서브리퀘스트를 제한. 폭주해도 Worker 하나 이상의 비용은 나지 않음
- `compatibilityDate` / `compatibilityFlags`는 일반 Worker와 같은 의미

컨테이너 대신 isolate를 고른 이유는 기동이 밀리초이고 요청마다 버리기에 알맞기 때문입니다.

## 넘길 수 있는 바인딩과 없는 바인딩

자식의 `env`에는 구조화 복제 가능한 값과 Service Binding만 넣을 수 있습니다.

| 바인딩          | 전달 방식                                                 |
| --------------- | --------------------------------------------------------- |
| D1              | 그대로 (복제 가능)                                        |
| Durable Objects | `namespace.get(id)`의 stub (Service Binding)              |
| KV / R2 / AI    | namespace 자체는 전달 불가 → Durable Object 메서드로 중계 |

예를 들어 KV는 `get` / `put` / `delete` / `list`를 가진 Durable Object 하나를 두고 그 stub을 `env.KV`로 넘깁니다. 호출하는 쪽 코드는 실제 namespace와 거의 같습니다.

## Turnstile은 브라우저당 한 번

입구에서 Turnstile을 검증하고 성공하면 서명된 쿠키를 설정합니다. 이후 요청은 챌린지를 건너뜁니다. 토큰은 일회용이라 검증마다 새것이 필요합니다.

## 비용은 어디서 나오나

- Dynamic Workers는 하루에 만든 고유 Worker 수로 과금되므로 같은 코드는 같은 `get()` id를 재사용합니다. 월 1,000개까지 포함이고, 초과하면 개당 하루 $0.002
- id는 코드에서 만들며 줄바꿈과 끝 개행만 정규화하므로, 교재 코드를 그대로 실행하는 사람은 모두 하나의 Worker를 공유합니다
- CPU는 100ms에서 끊고, 대기 시간은 무료라 외부 API 호출이 저렴
- Workers AI는 저렴한 모델로 고정하고 실행 횟수 상한을 둠

## 그대로 가져다 쓸 구조

1. 부모 Worker가 Worker Loader를 가진다
2. 사용자 코드를 `modules`에 넣고 `load()` / `get()` 호출
3. 필요한 바인딩만 Service Binding으로 좁혀 전달
4. 외부 통신을 막거나 중계 바인딩으로만 허용
5. CPU와 서브리퀘스트 상한 설정

이 다섯 가지로 남의 코드를 안전하게 실행하는 자리를 만들 수 있습니다.
