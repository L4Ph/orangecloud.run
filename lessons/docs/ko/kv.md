# KV (Key-Value)

읽기가 빠르고 전 세계 엣지로 복제되는 키-값 저장소입니다. **쓰기는 최종 일관성**(최대 60초)이라 카운터나 재고처럼 정확성이 필요한 용도에는 맞지 않습니다.

## 어울리는 용도

- 설정 값, 기능 플래그, 리다이렉트 표
- 세션 캐시, OGP 이미지 캐시
- 쓰기가 적고 읽기가 많은 데이터

## 기억할 것

- `get` / `put` / `delete` / `list`(프리픽스)
- 값 하나에 25MB까지, JSON으로 저장하면 읽기 편함
- 목록은 `list()`로 프리픽스 검색. 전체 스캔은 약함
- 쓰기가 읽기보다 비쌈 (100만 쓰기당 $5)

이 환경의 `env.KV`는 실제 KV를 RPC로 중계한 것입니다. `get/put/delete/list` 모양은 프로덕션과 같으니 그대로 익히면 됩니다.

```js
await env.KV.put('user:1', 'Alice');
await env.KV.get('user:1'); // 'Alice'
await env.KV.list('user:'); // ['user:1', 'user:2', ...]
```
