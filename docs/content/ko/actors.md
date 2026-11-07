# Durable Objects와 Actor 모델

Durable Objects(DO)는 “상태를 가진 작은 서버”로 설명되지만, 실체는 **Actor 모델**의 구현입니다. Actor 모델을 알면 DO가 왜 클래스로 작성되고, 왜 메서드 호출이 직렬화되는지 이해됩니다.

## Actor 모델의 약속

Actor 시스템(Erlang 프로세스, Akka Actor)은 네 가지로 이루어집니다.

1. **동일성**: 모든 actor는 이름으로 지목되며, 같은 이름은 항상 같은 실체
2. **사적 상태**: 상태는 actor 내부에만 있고 밖에서 직접 만질 수 없음
3. **메시지**: 외부와의 상호작용은 메시지뿐이며, 사서함에 순서대로 쌓임
4. **한 번에 하나**: actor는 메시지를 하나씩 처리하므로 내부 경쟁 상태가 없음

공유 메모리도 잠금도 필요 없고, 실체가 어디 있는지 몰라도 됩니다(location transparency).

## Durable Objects와의 대응

| Actor 모델      | Durable Objects                                      |
| --------------- | ---------------------------------------------------- |
| actor 이름      | `env.ROOM.get(env.ROOM.idFromName('room-1'))`의 이름 |
| 사적 상태       | `ctx.storage`(SQLite)와 `this`의 필드                |
| 메시지          | `fetch()`(HTTP)와 RPC 메서드                         |
| 사서함과 직렬화 | 플랫폼이 보장, 메서드는 하나씩 실행                  |
| 소멸과 재생성   | isolate 회수와 hibernation, 상태는 storage에         |
| 위치            | 처음 접근한 colo                                     |

## 왜 클래스인가

**클래스는 행동의 단위이자 배포·마이그레이션의 단위**입니다. 인스턴스는 이름으로 구분합니다.

- 같은 행동의 실체를 수천 개 만들기 때문에 타입(클래스)과 인스턴스(이름)를 분리해야 함
- 클래스 이름이 바인딩과 migration(`new_sqlite_classes`)의 단위. 다른 클래스로 옮기면 다른 리소스
- 메서드가 곧 메시지 핸들러. RPC는 타입이 있고 `fetch`는 HTTP용
- `this.ctx`에 storage, alarm, id가 붙음. 능력이 인스턴스에 속함
- 생성자는 **활성화될 때마다** 실행됨. 필드는 휘발성, 영속은 storage — 언어 차원에서 구분을 강제

함수와 KV로 직접 구현하면 직렬화, 상호 배제, 복구, 배치를 다시 만들어야 합니다.

## 코드 형태

```ts
export class Room extends DurableObject {
  async join(user: string) {
    const members = (await this.ctx.storage.get<string[]>('members')) ?? [];
    if (!members.includes(user)) members.push(user);
    await this.ctx.storage.put('members', members);
    return members;
  }

  async alarm() {
    // 30분 뒤 한 번 깨어남
    await this.ctx.storage.deleteAll();
  }
}
```

`join`은 RPC 메서드입니다. 두 호출이 동시에 와도 하나씩 처리되므로 `members`가 깨지지 않습니다.

## 한계

- **내부 병렬성 없음**: DO 하나는 대략 코어 하나의 처리량. 핫 키는 나누기(사용자별, 방별)
- 다른 메시지는 **`await` 지점에서만** 끼어듭니다. await를 넘어 상태를 읽을 때 순서에 주의
- 많은 행을 스캔하는 작업에는 부적합. 집계는 D1, 바이트는 R2
- 위치는 첫 접근에서 결정. 전 세계를 하나의 DO로 모으면 느립니다
- 유휴 시 과금 없음(hibernation). WebSocket은 Hibernation API

## actor가 맞는 문제

채팅방, 재고, 게임 방, 레이트 리미터, 워크플로 조정자, AI 에이전트의 기억. **“같은 이름의 상태를 동시에 한 호출자만”**이 요구라면 DO입니다. 읽기 위주 목록과 집계는 D1, 바이트는 R2가 맞습니다.
