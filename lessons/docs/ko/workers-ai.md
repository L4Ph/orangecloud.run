# Workers AI

Cloudflare의 GPU에서 모델을 돌리는 방식입니다. **추론 엔진도 GPU 관리도 직접 갖지 않고** 모델 이름과 입력만 넘깁니다. 서버리스이므로 사용한 만큼만 과금됩니다.

## 우선 저렴한 모델부터

| 모델                            | 용도              | 대략            |
| ------------------------------- | ----------------- | --------------- |
| `@cf/google/gemma-4-26b-a4b-it` | 범용 대화·요약    | 저렴. 먼저 이것 |
| `@cf/openai/gpt-oss-20b`        | 어려운 추론       | 비쌈            |
| `@cf/baai/bge-small-en-v1.5`    | 임베딩(검색, RAG) | 매우 저렴       |
| `@cf/openai/whisper`            | 음성→문자         | 초 단위 과금    |

가격은 입력·출력 토큰 종량제입니다. 저렴한 모델이면 1회에 몇 원 미만입니다. 먼저 저렴한 모델로 돌리고 부족할 때만 올리세요.

모델은 자주 바뀝니다. 쓰기 전에 [Workers AI 모델 카탈로그](https://developers.cloudflare.com/workers-ai/models/)에서 ID와 폐기 예정을 확인하세요. 위의 ID도 언젠가 사라집니다.

## 호출 방법

```js
const answer = await env.AI.run('@cf/google/gemma-4-26b-a4b-it', {
  messages: [
    { role: 'system', content: '짧게 답한다.' },
    { role: 'user', content: 'Cloudflare Workers를 한 문장으로' },
  ],
});
answer.response; // 문자열
```

- `stream: true`로 스트리밍(SSE)
- 임베딩: `env.AI.run('@cf/baai/bge-small-en-v1.5', { text: [...] })` → Vectorize에 넣어 검색
- 이미지 생성, 음성 인식, 번역도 같은 `run()`으로 호출

## 이 환경에서의 주의

이 사이트는 **비용을 사이트가 부담합니다.** API 키는 필요 없습니다(Workers AI는 바인딩 자체가 인증을 겸함).

다만 Workers AI에는 로컬 시뮬레이터가 없어서 `npm run dev`로 시도할 때만 Cloudflare 로그인이 필요합니다. 인증 오류가 나면 `npx wrangler login` 후 다시 실행하세요. 배포 후에는 누구나 그대로 동작합니다.

공개할 때는 실행 횟수 제한과 저렴한 모델 고정을 잊지 마세요. 다음 장의 **AI Gateway**를 앞에 두면 캐시, 레이트 리밋, 비용 파악을 한 번에 얻습니다.
