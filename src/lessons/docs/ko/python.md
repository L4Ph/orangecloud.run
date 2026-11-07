# Python Workers

에지 환경에서 Python 스크립트를 구동하려는 시도는 오랫동안 어려운 과제로 남아 왔다. Docker 컨테이너를 실행하려 하면 수 초의 콜드 스타트를 감수해야 하며, 가상 머신의 메모리 소모 문제로 고심하게 된다. 한편, 데이터 처리나 텍스트 분석, 머신러닝의 접착 코드는 여전히 Python으로 작성하는 것이 가장 자연스럽다.

Cloudflare의 **Python Workers**는 이 간극을 메우는 접근 방식을 취한다. 컨테이너를 실행하는 대신, V8 isolate 내부에서 WebAssembly로 컴파일된 Python 실행 기반(Pyodide)을 직접 구동한다. 배포 시점에 초기화가 끝난 메모리의 스냅샷을 만들고, 요청 시 이를 복원하여 기동을 빠르게 한다. 그래도 JavaScript Worker보다 콜드 스타트는 무거우며, Cloudflare의 측정(2025년 12월)에서는 FastAPI·httpx·pydantic을 import하는 Worker가 평균 1.027초였다.

## 구문 구조와 엔트리 포인트

```python
from workers import Response, WorkerEntrypoint

class Default(WorkerEntrypoint):
    async def fetch(self, request):
        return Response.json({"runtime": "python", "status": "ok"})
```

- `WorkerEntrypoint`를 상속받은 `Default` 클래스의 `fetch` 메서드가 요청 수신처가 된다. 이는 JavaScript의 `export default { fetch }`와 완전히 동일한 역할을 수행한다.
- `Response` 클래스는 웹 표준 HTTP 응답 사양을 준수하며, `Response.json()`을 통해 직관적으로 JSON 데이터를 반환할 수 있다.
- KV나 D1 같은 Cloudflare 리소스에 대한 액세스는 인스턴스 변수 `self.env`를 통해 투명하게 이루어진다.
- 실행하려면 Worker 설정에서 호환성 플래그 `python_workers`를 활성화한다.

## 적용 영역의 경계

- **강점을 발휘하는 영역**: JSON 데이터 변환, 정규 표현식을 이용한 고도의 텍스트 서식 지정, 기존 Python 비즈니스 로직의 포팅, LLM에서 받은 출력의 후처리.
- **피해야 할 영역**: isolate의 메모리 상한(128MB)에 들어가지 않는 대규모 데이터 처리, 스레드와 멀티프로세스(`threading`과 `multiprocessing`은 import할 수 있어도 동작하지 않는다), WebAssembly 빌드가 없는 네이티브 확장을 가진 패키지. numpy·pandas·scipy는 Pyodide가 Wasm 빌드를 제공하므로, 네이티브 확장이 있다는 이유만으로 피할 필요는 없다. OS 수준의 완전한 환경이 필요한 경우에는 컨테이너 실행 환경(Containers)을 선택해야 한다.

실행 시의 `print()` 출력은 플랫폼의 모니터링 로그(Tail)로 전달된다. 브라우저로 즉시 결과를 반환하고 싶은 변수는 `Response.json()`의 응답 페이로드에 포함하여 반환하는 것이 확실하다.
