# Containers

Workers(isolate)로 부족할 때의 **마지막 수단**입니다. Docker 이미지를 그대로 실행할 수 있고, Cloudflare가 Durable Object 뒤에서 컨테이너를 켜고 끕니다.

## isolate로 부족한 예

- 네이티브 바이너리나 무거운 의존성(ffmpeg, Python 과학 계산, Playwright)
- 오래 살아 있는 프로세스(WebSocket 서버, 게임 서버)
- 128MB를 넘는 메모리가 필요한 처리
- 기존 Docker 이미지를 그대로 쓰고 싶을 때

반대로 "HTTP를 기다릴 뿐"이거나 "DB를 조회할 뿐"이라면 isolate가 더 빠르고 쌉니다. **먼저 Workers로 쓸 수 있는지 생각**하는 것이 원칙입니다.

## 코드의 모양

```ts
const sandbox = await getSandbox('user-123');
const result = await sandbox.run(['node', '--version']);
```

Void에는 Cloudflare Sandbox(`void/sandbox`)가 통합되어 있어 `getSandbox(id)`로 컨테이너를 얻고 `run`, 파일 조작, 포트 공개를 할 수 있습니다.

## 가격과 기동

| 항목 | 유료 플랜 |
| --- | --- |
| 메모리 | 월 25 GiB 시간 포함 |
| CPU | 월 375 vCPU 분 포함 |
| 기동 | 초 단위 (isolate는 밀리초) |
| 중지 | 유휴 시 슬립, 사용 중에만 과금 |

**기동에 초가 걸리고, 쓰지 않아도 이미지 빌드와 배치에 비용이 들기** 때문에 교육용 샌드박스에는 isolate(Dynamic Workers)가 맞습니다. 이 사이트도 그 구성입니다.

이 장은 자료만 제공합니다(컨테이너 빌드와 실행에는 Docker와 유료 Workers 플랜이 필요).
