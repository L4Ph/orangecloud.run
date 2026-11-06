# JavaScript 엔진과 런타임

코드는 마법으로 돌아가지 않습니다. **엔진**이 구문을 분석해 실행하고, **런타임**이 그 엔진에 "바깥 세계"를 연결합니다. 이 둘을 나눠 보면 Cloudflare Workers의 위치가 한 번에 보입니다.

## 엔진 (JavaScript를 실행하는 부분)

| 엔진               | 주로 쓰이는 곳                               | 특징                                       |
| ------------------ | -------------------------------------------- | ------------------------------------------ |
| **V8**             | Chrome / Node.js / Deno / Cloudflare Workers | JIT 포함. 가장 빠른 축이지만 바이너리가 큼 |
| **SpiderMonkey**   | Firefox (Gecko)                              | 초창기 구현. JIT(Ion) 포함                 |
| **JavaScriptCore** | Safari (WebKit) / Bun                        | Apple 제작. JIT가 있고 가벼움              |
| **QuickJS**        | 임베디드, 작은 환경                          | 수백 KB급. JIT 없이 시작이 빠름            |
| **Hermes**         | React Native                                 | 시작 시간과 메모리 우선. AOT 컴파일        |

엔진의 일은 소스를 읽고 → 구문 트리로 만들고 → 실행하고 → 쓸모없는 메모리를 회수(GC)하는 것까지입니다. 파일을 열 수도, HTTP를 기다릴 수도 없습니다.

## 런타임 (엔진에 세계를 연결하는 부분)

| 런타임                 | 엔진           | 바깥 세계를 만드는 방식                                                |
| ---------------------- | -------------- | ---------------------------------------------------------------------- |
| **Node.js**            | V8             | libuv + OS 시스템 콜. `fs`, `net`, `process`                           |
| **Bun**                | JavaScriptCore | Zig로 작성. `Bun.serve`, `Bun.file`                                    |
| **Deno**               | V8             | Rust로 작성. 권한 모델(`--allow-net` 등). **2025년 Cloudflare에 인수** |
| **Cloudflare Workers** | V8 isolate     | 엣지의 isolate. `fetch` 같은 웹 표준 + 바인딩                          |

`process`도 `require`도 없는데 `fetch`와 `crypto`는 있습니다. 그것이 Workers입니다. **isolate**는 프로세스도 컨테이너도 아니라, 한 프로세스에 여러 개를 채워 넣는 V8 실행 단위이며 시작은 몇 밀리초입니다.

아래 코드를 실행하면 이 Worker에 무엇이 있고 없는지 그대로 보입니다.

```js
typeof process; // undefined
typeof Deno; // undefined
typeof Bun; // undefined
typeof document; // undefined
typeof caches; // object (Workers의 Cache API)
```
