# JavaScript 엔진과 런타임

JavaScript를 브라우저 밖에서 구동하려는 순간, 실행 환경은 반드시 두 가지 부분으로 나뉜다. 소스 코드를 분석해 바이트코드나 기계어로 실행하는 **엔진**과, 그 엔진에 네트워크나 타이머 같은 외부 세계를 연결하는 **런타임**이다. 이 경계선을 의식하지 않으면 Cloudflare Workers의 아키텍처는 보이지 않는다.

## 엔진(실행을 담당하는 심장부)

| 엔진               | 주요 활용처                                  | 특징                                                  |
| ------------------ | -------------------------------------------- | ----------------------------------------------------- |
| **V8**             | Chrome / Node.js / Deno / Cloudflare Workers | Google 제작. 다단계 JIT 컴파일러를 갖춤               |
| **SpiderMonkey**   | Firefox(Gecko)                               | Mozilla 제작. JIT는 Baseline과 Warp(IonMonkey의 후속) |
| **JavaScriptCore** | Safari(WebKit) / Bun                         | Apple 제작. 인터프리터와 3단계 JIT로 실행             |
| **QuickJS**        | 임베디드·경량 환경                           | 수백 KB급. JIT 없이 초소형·즉시 기동                  |
| **Hermes**         | React Native                                 | AOT 컴파일 전제. 기동 시간과 메모리를 우선시          |

엔진이 맡는 일은 ECMAScript(JavaScript의 언어 사양)와 WebAssembly의 실행이다. 소스 코드를 읽고, 추상 구문 트리를 조립하며, 바이트코드 또는 기계어로 실행한다. `Array`나 `Promise` 같은 내장 객체를 제공하고, 불필요해진 메모리를 가비지 컬렉션(GC)으로 회수한다. 파일을 여는 기능도, 네트워크 소켓을 대기하는 기능도 ECMAScript 사양에는 포함되어 있지 않다.

## 런타임(세계와의 접점)

엔진에 '외부 세계'와 대화할 수단을 부여하는 것이 런타임이다.

| 런타임                 | 엔진           | 외부 세계로의 인터페이스                                                                     |
| ---------------------- | -------------- | -------------------------------------------------------------------------------------------- |
| **Node.js**            | V8             | libuv를 통한 OS 시스템 콜. `fs`, `net`, `process`                                            |
| **Bun**                | JavaScriptCore | Rust로 작성한 네이티브 구현. `Bun.serve`, `Bun.file`. **2025년 12월 Anthropic이 인수**       |
| **Deno**               | V8             | Rust 제작. 세밀한 권한 모델(`--allow-net` 등). **2026년 10월 Cloudflare에 합류**             |
| **Cloudflare Workers** | V8             | 엣지 상의 격리 환경. 런타임은 오픈소스 workerd. Web 표준 API(`fetch` 등) + Cloudflare 바인딩 |

같은 V8 엔진을 탑재하고 있으니 Node.js와 Workers는 똑같이 동작할 것이다——라고 생각하고 코드를 가져오면, 처음 몇 줄에서 발을 헛디디게 된다. Workers에는 로컬 디스크가 없고, ES modules 형식의 Worker에는 `require`도 없다. `process`와 `node:fs`는 호환 계층(`nodejs_compat`)이 제공하는 것으로, 호환 날짜(compatibility date)가 2026-08-04 이후인 Worker에서는 기본으로 활성화된다. 다만 `node:fs`의 실체는 메모리상의 가상 파일 시스템이다.

Workers의 기본이 되는 것은 브라우저에서 익숙한 Web 표준(`fetch`, `Request`, `Response`, `crypto`)과 플랫폼 고유의 바인딩이다.

Workers를 뒷받침하는 **V8 isolate**는 OS 프로세스도 아니고 독립된 컨테이너도 아니다. 단일 OS 프로세스 내에 수백에서 수천 개의 독립된 실행 공간을 채워 넣는다. 독립된 메모리 공간을 가지면서도, 기동은 컨테이너나 가상 머신 위의 Node 프로세스보다 약 100배 빠르다고 Cloudflare는 설명한다.

에디터에서 코드를 실행하면 글로벌 공간의 검증 결과가 출력된다. 이 에디터의 Worker는 호환 날짜 2026-02-24, `nodejs_compat` 없이 동작하므로 `process`는 존재하지 않는다. 출력의 `navigator = object`는 `navigator.userAgent`가 `Cloudflare-Workers`를 반환하는 객체로, 실행 환경을 판별하는 데 쓸 수 있다. 이 환경에 무엇이 존재하고, 무엇이 걷혀 나갔는지 확인해 보길 바란다.

```js
typeof process; // undefined (Node.js의 흔적은 없음. nodejs_compat을 켜면 object)
typeof Deno; // undefined
typeof Bun; // undefined
typeof document; // undefined (브라우저의 DOM도 없음)
typeof caches; // object (Cache API. 브라우저 버전과 다른 점이 있음)
```
