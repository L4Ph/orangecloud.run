# AI Gateway

모델 API **앞에 서는 관문**입니다. 추론은 하지 않습니다. OpenAI, Anthropic, Gemini, Workers AI 등으로 가는 호출을 하나의 URL로 모으고 로그·캐시·제한·폴백을 붙입니다.

## 무엇이 좋은가

- **로그**: 누가 어떤 모델을 몇 토큰 썼는지 모두 남음
- **캐시**: 같은 프롬프트는 캐시에서 반환(비용 절감)
- **레이트 리밋**: 사용자당 분당 N회 등
- **폴백**: 저렴한 모델이 실패하면 다른 모델로
- **비용 제어**: 예산 알림과 상한

## 쓰는 두 가지 방법

1. **프로바이더 URL 교체**: `https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway}/openai/chat/completions`
2. **Workers의 `ai` 바인딩으로 호출** (Gateway를 거치게 하려면 1번의 URL 사용)

```js
const res = await fetch(
  `https://gateway.ai.cloudflare.com/v1/${accountId}/${gateway}/anthropic/v1/messages`,
  {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_KEY },
    body: JSON.stringify({ model: 'claude-3-5-haiku', max_tokens: 200, messages: [...] }),
  },
);
```

## 모두가 부담 없이 쓰게 하는 요령

- 기본은 가장 저렴한 모델. 상위 모델은 명시적 버튼 뒤에만
- 캐시를 켜서 같은 질문에 두 번 과금하지 않기
- 인증이 있으면 사용자 단위, 없으면 IP 단위로 제한
- 입력 길이를 서버에서 자르기 (긴 글을 그대로 보내지 않기)
- 실패 시 폴백 대상을 미리 정하기

이 장은 자료만 제공합니다(계정의 Gateway 설정과 API 키가 필요).
