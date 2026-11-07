# Containers에서 실행하기

isolate(Workers)는 빠르고 저렴한 대신 OS 명령도, 네이티브 라이브러리도, 파일 시스템도 없습니다. **Containers**는 그 제약을 포기하는 자리입니다. Docker 이미지를 그대로 실행합니다.

이 장의 에디터는 작성한 Python을 컨테이너 안의 파일에 넣고 `python3`로 실행합니다. `print` 출력이 그대로 돌아옵니다.

## 무엇이 달라지나

|           | isolate          | container                         |
| --------- | ---------------- | --------------------------------- |
| 기동      | 밀리초           | 초                                |
| 사용 가능 | 웹 표준 + 바인딩 | OS 명령, 임의 바이너리, pip / apt |
| 파일      | 없음             | 있음(휘발)                        |
| 과금      | 요청 + CPU       | 실행 시간 + 메모리                |

Python, ffmpeg, Playwright, 네이티브 확장을 쓰는 과학 계산은 isolate에서 동작하지 않습니다. 반대로 HTTP 대기나 DB 조회만 한다면 isolate가 더 빠르고 저렴합니다.

## 이 사이트의 구현

- 이미지는 `Dockerfile.sandbox`(Node 이미지 + `python3`)
- `getSandbox('lesson-container')`로 컨테이너 하나를 얻어 재사용
- 실행마다 `/workspace/run-<id>.py`를 쓰고 `python3`로 실행한 뒤 삭제
- 외부 통신은 차단

```ts
const sandbox = await getSandbox('lesson-container');
await sandbox.files.writeFile('/workspace/main.py', code);
const result = await sandbox.run(['python3', 'main.py'], { cwd: '/workspace' });
```

## 주의

- 컨테이너는 **기동에 초**가 걸리고 유휴 시 멈추므로 첫 실행이 느립니다
- 실행 중에는 과금됩니다. 빈도가 높은 작업에 맞지 않습니다
- 상태는 남지 않습니다. 필요한 것은 D1 / R2 / KV에

isolate와 컨테이너의 경계는 [런타임 깊이 보기](/docs/runtimes)에 정리했습니다.
