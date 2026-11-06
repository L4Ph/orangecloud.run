# 배포까지

로컬에서 동작하면 마지막은 자신의 계정으로 내보내는 일입니다.

## 순서

```sh
# 1. Cloudflare 로그인 (브라우저가 열림)
npx void cloudflare login

# 2. 프로덕션 시크릿 등록 (.env는 업로드되지 않음)
npx void secret put MY_API_KEY

# 3. 배포 (처음에는 계정과 리소스를 선택)
npx void deploy --platform cloudflare
```

처음 배포하면 D1 같은 리소스가 자동 생성되고 `void.lock.json`에 기록됩니다. **이 파일은 커밋하세요.** 마이그레이션 이력이 들어 있습니다.

## 배포 전 확인

- [ ] 시크릿은 `env.ts` 스키마 + `void secret put`. 코드에 직접 쓰지 않기
- [ ] `env.DB` 같은 바인딩 이름이 프로덕션에서도 같은지
- [ ] 무한 루프가 없는지 (CPU 제한이 죽이지만 그동안 요청은 실패)
- [ ] 예상보다 큰 응답을 반환하지 않는지
- [ ] 청구서를 읽을 수 있는 상태인지 (대시보드 Usage)

## 공개한 뒤

- 커스텀 도메인 연결 (Workers Custom Domain)
- 로그 보기 (`cf` CLI 또는 대시보드. `wrangler tail` 상당)
- 트래픽이 늘면 캐시 추가 (Cache API / 정적 자산)

## 이 사이트의 구성

이 사이트는 **Void(Vite+) + Cloudflare Workers**로 돌아갑니다. 왼쪽 에디터의 코드는 요청마다 **Dynamic Workers**(런타임에 Worker를 하나 만드는 방식)로 실행되고 네트워크가 막혀 있어 무엇을 써도 깨지지 않습니다.

- 실행 기반: `env.LOADER` (Worker Loader 바인딩)
- 실행별 제한: CPU 100ms, 외부 통신 없음
- KV / R2 / AI는 Durable Object를 통해 중계(isolate에 넘길 수 없기 때문)
- D1과 Durable Objects는 실제 바인딩을 직접 전달
