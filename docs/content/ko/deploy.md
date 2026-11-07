# 배포까지

로컬에서 동작하면 Cloudflare 계정으로 내보냅니다. 이 장에서는 공식 CLI인 Wrangler를 씁니다.

## 순서

```sh
# 1. 로그인 (브라우저가 열림)
npx wrangler login

# 2. 로컬에서 확인
npx wrangler dev

# 3. 배포
npx wrangler deploy
```

새 프로젝트라면 `npm create cloudflare@latest`로 템플릿에서 시작하는 편이 빠릅니다.

## 시크릿과 리소스

```sh
# API 키는 코드에 쓰지 말고 Worker 시크릿에 넣기
npx wrangler secret put API_KEY

# D1 데이터베이스
npx wrangler d1 create my-db
npx wrangler d1 migrations apply my-db --remote

# KV / R2 / Queue도 create로 만들고 wrangler.jsonc에 바인딩
```

바인딩은 `wrangler.jsonc`에 정의합니다. 로컬에서는 Miniflare가 같은 설정을 읽으므로 코드의 `env.DB` 등이 프로덕션과 동일하게 동작합니다.

## 배포 전 확인

- [ ] 시크릿은 `wrangler secret put`. 코드나 `vars`에 직접 쓰지 않기
- [ ] 바인딩 이름이 프로덕션에서도 같은지 (`wrangler.jsonc`)
- [ ] 무한 루프가 없는지 (CPU 제한이 죽이지만 그동안 요청은 실패)
- [ ] 예상보다 큰 응답을 반환하지 않는지
- [ ] 청구서를 읽을 수 있는지 (대시보드 Usage)

## 공개한 뒤

- 커스텀 도메인 연결 (Workers Custom Domain)
- 로그 보기: `npx wrangler tail`
- 트래픽이 늘면 캐시 추가 (Cache API / 정적 자산)
