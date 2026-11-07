# Python

Workers는 JavaScript만의 공간이 아닙니다. **Python Workers**를 쓰면 같은 isolate에서 Python이 동작합니다.

## 형태

```python
from workers import Response, WorkerEntrypoint

class Default(WorkerEntrypoint):
    async def fetch(self, request):
        return Response.json({"hello": "python"})
```

- `Default` 클래스의 `fetch`가 진입점입니다. JavaScript의 `export default { fetch }`와 같은 역할
- `Response`는 표준 응답 객체이고 `Response.json()`으로 JSON을 반환합니다
- 바인딩과 환경 변수는 `self.env`로 접근합니다(`self.env.KV` 등)

## 실행하려면

Worker 설정에 호환 플래그가 필요합니다.

```jsonc
{ "compatibility_flags": ["python_workers"] }
```

로컬은 `npx wrangler dev`, 배포는 `npx wrangler deploy`. 이 사이트의 에디터는 실행할 때 같은 플래그를 붙입니다.

## 맞는 일과 맞지 않는 일

- 맞음: 데이터 정리, 텍스트 처리, 기존 Python 로직 이식, AI 결과 후처리
- 맞지 않음: 무거운 과학 계산, 네이티브 확장, 수 GB 데이터. 패키지는 Pyodide 수준의 제약이 있어 `numpy`가 돌아도 느립니다. 정말 필요할 때는 Containers

## 로그

`print()`는 Workers 로그(tail)로 가고 이 사이트의 응답에는 포함되지 않습니다. 보고 싶은 값은 `Response.json()`에 담아 반환하세요.
