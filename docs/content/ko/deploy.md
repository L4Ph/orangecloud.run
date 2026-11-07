# 에지 배포 및 운영

로컬 시뮬레이터(Miniflare)에서 동작을 확인한 코드를 전 세계 수백 곳의 에지 데이터 센터로 배포한다. Cloudflare의 공식 CLI인 **cf**(베타)를 통해 설정 파일과 빌드 결과물을 전 세계 네트워크로 동기화한다. 기존 Wrangler도 쓸 수 있지만 새 프로젝트는 `cf`를 전제로 한다.

## 개발 및 배포의 기본 사이클

```sh
# 초기 인증(브라우저가 실행되어 계정 연동 수행)
cf auth login

# 로컬 에뮬레이터를 통한 동작 확인(빠른 피드백)
cf dev

# 에지 네트워크로의 프로덕션 배포(통상 수 초 내에 전 세계로 전파)
cf deploy
```

새 프로젝트는 `cf init my-worker`로 만든다. `cloudflare.config.ts`, 타입 정의, `dev` / `build` / `deploy` 스크립트가 갖춰진 상태로 시작한다. 기존 Wrangler 프로젝트는 `cf migrate`로 `cloudflare.config.ts`로 변환할 수 있다.

## 기밀 정보 및 외부 리소스 연결

코드베이스 내에 API 키나 서명용 시크릿을 직접 커밋하는 행위는 엄격히 금지한다. 환경 변수에는 '공개되어도 좋은 정적 설정(`vars`)'과 '암호화하여 저장해야 하는 기밀 정보(`secrets`)'의 명확한 경계가 존재한다.

```sh
# 암호화 시크릿 등록(대시보드상에서도 값이 숨김)
npx wrangler secret put STRIPE_API_KEY --name my-worker

# D1을 만드는 명령은 설명문으로 찾을 수 있다
cf cli search "create a D1 database"

# 프로덕션 마이그레이션 적용 (cf는 데이터베이스 ID를 받으며 기본적으로 원격에 적용한다)
cf d1 migrations apply <DATABASE_ID>
```

`cf`에는 시크릿을 하나씩 등록하는 명령이 아직 없다. 당분간은 `npx wrangler secret put`을 쓰거나 `cf deploy --secrets-file <PATH>`로 한꺼번에 전달한다.

각종 리소스에 대한 연결 설정은 프로젝트 루트의 `cloudflare.config.ts`에 타입과 함께 기술한다(`bindings.d1()` 같은 빌더를 사용). 로컬 개발에서도 이 정의를 읽으므로 프로덕션과 동일한 `env.DB` 및 `env.KV` 인터페이스로 개발을 이어갈 수 있다.

## 배포 전 검증해야 할 경계선

- **시크릿 분리**: API 토큰이나 비밀키가 설정 파일의 `vars` 항목이나 소스 코드에 평문으로 남아 있지 않은가.
- **바인딩 이름의 완전 일치**: 소스 코드에서 참조하는 `env` 프로퍼티 이름과 설정 파일 내의 `binding` 정의 이름에 차이가 없는가.
- **CPU 제한 시간 고려**: 외부 데이터 처리나 무거운 루프 처리가 플랜의 제한 시간(무료 요금제 10ms, 유료 요금제 30초)을 초과하여 강제 종료를 초래할 우려는 없는가.
- **테일 로그를 통한 모니터링 체계**: 배포 직후의 실제 트래픽 동작은 에지의 표준 출력 로그를 실시간으로 확인해 검증한다. `cf`는 아직 지원하지 않으므로 `npx wrangler tail <WORKER_NAME>`을 사용한다.
