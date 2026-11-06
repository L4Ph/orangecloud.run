# Durable Objects (DO)

**이름마다 전 세계에 단 하나만 존재하는** 객체입니다. 내부에 SQLite 저장소와 직렬화된 메서드 호출을 가집니다. "동시에 둘이 존재하지 않는다"가 보장되므로 카운터, 재고, 채팅방, 레이트 리미터, 조정자를 이것으로 만듭니다.

## 왜 필요한가

Workers는 요청마다 다른 isolate에 올라갈 수 있어 전역 변수를 믿을 수 없습니다. DO는 **이름으로 하나의 실체를 호출하는** 방식입니다. 예: `Counter.get('global')`. 호출은 그 실체 안에서 하나씩 순서대로 처리됩니다.

## 기억할 것

- `env.COUNTER`에 이름을 넘기면 그 이름의 실체 stub이 반환됨
- stub의 메서드는 RPC. 반환값은 직렬화 가능해야 함
- 저장소는 SQLite (`ctx.storage.get/put`, SQL도 가능)
- `ctx.storage.setAlarm()`으로 "나중에 깨워줘"가 가능 (리마인더, 배치)
- 유휴 상태에서는 과금되지 않음 (hibernation)

여기서 `env.COUNTER`는 실제로 배포된 Durable Object입니다. **값은 실행 사이에도 남습니다.** 여러 번 실행해 늘어나는 것을 확인하세요.

```js
const n = await env.COUNTER.increment(); // 같은 이름이면 같은 실체
await env.COUNTER.read(); // 저장된 값을 읽음
```
