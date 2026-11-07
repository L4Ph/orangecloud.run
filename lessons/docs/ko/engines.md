# JavaScript 엔진과 런타임

JavaScript를 브라우저 밖에서 구동하려는 순간, 실행 환경은 반드시 두 가지 부분으로 나뉜다. 구문 트리를 해석해 기계어로 변환하는 **엔진**과, 그 엔진에 네트워크나 타이머 같은 외부 세계를 연결하는 **런타임**이다. 이 경계선을 의식하지 않으면 Cloudflare Workers의 아키텍처는 보이지 않는다.

## 엔진(실행을 담당하는 심장부)

| 엔진           | 주요 활용처                                   | 특징                                 |
| ------------------ | -------------------------------------------- | ------------------------------------ |
| **V8**             | Chrome / Node.js / Deno / Cloudflare Workers | JIT 컴파일 탑재. 고속이지만 바이너리는 크다 |
| **SpiderMonkey**   | Firefox(Gecko)                             | 초기부터 있었던 구현체. JIT(Ion) 탑재   |
| **JavaScriptCore** | Safari(WebKit) / Bun                        | Apple 제작. JIT 탑재로 기동 및 메모리 효율이 뛰어남 |
| **QuickJS**        | 임베디드·경량 환경                           | 수백 KB급. JIT 없이 초소형·즉시 기동 |
| **Hermes**         | React Native                                 | AOT 컴파일 전제. 기동 시간과 메모리를 우선시 |

엔진의 책임은 극히 좁다. 소스 코드를 읽고, 추상 구문 트리를 조립하며, 바이트코드 또는 기계어로 실행하고, 불필요해진 메모리를 가비지 컬렉션(GC)으로 회수한다. 그뿐이다. 파일을 여는 기능도, 네트워크 소켓을 대기하는 기능도 엔진 단독으로는 일절 갖추고 있지 않다.

## 런타임(세계와의 접점)

엔진에 '외부 세계'와 대화할 수단을 부여하는 것이 런타임이다.

| 런타임             | 엔진       | 외부 세계로의 인터페이스                                               |
| ---------------------- | -------------- | -------------------------------------------------------------------------- |
| **Node.js**            | V8             | libuv를 통한 OS 시스템 콜. `fs`, `net`, `process`                     |
| **Bun**                | JavaScriptCore | 자체 네이티브 구현(Zig/Rust). `Bun.serve`, `Bun.file`                  |
| **Deno**               | V8             | Rust 제작. 세밀한 권한 모델(`--allow-net` 등). **2025년 Cloudflare가 인수** |
| **Cloudflare Workers** | V8 isolate     | 엣지 상의 격리 환경. Web 표준 API(`fetch` 등) + Cloudflare 바인딩  |

같은 V8 엔진을 탑재하고 있으니 Node.js와 Workers는 똑같이 동작할 것이다——라고 생각하고 코드를 가져오면, 처음 몇 줄에서 발을 헛디디게 된다. Workers에는 `process`도 `require`도, 로컬 파일 시스템조차 존재하지 않는다.

대신 존재하는 것은 브라우저에서 익숙한 Web 표준(`fetch`, `Request`, `Response`, `crypto`)과 플랫폼 고유의 바인딩이다.

Workers를 뒷받침하는 **V8 isolate**는 OS 프로세스도 아니고 독립된 컨테이너도 아니다. 단일 OS 프로세스 내에 수천 개의 독립된 실행 공간을 빈틈없이 채워 넣는다. 독립된 메모리 공간을 가지면서도 기동에 걸리는 시간은 수 밀리초에 불과하다.

에디터에서 코드를 실행하면 글로벌 공간의 검증 결과가 출력된다. 이 환경에 무엇이 존재하고, 무엇이 걷혀 나갔는지 확인해 보길 바란다.

```js
typeof process; // undefined (Node.js의 흔적은 없음)
typeof Deno; // undefined
typeof Bun; // undefined
typeof document; // undefined (브라우저의 DOM도 없음)
typeof caches; // object (Web 표준의 Cache API)
```
