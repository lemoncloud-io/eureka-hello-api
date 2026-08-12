---
type: guide
audience: ai-agent
tags:
  - backend-service
  - backend-proxy
  - manager-proxy
  - use-case
  - ai-agent
glossary:
  use-case: src/lib/<domain>/ 아래 비즈니스 흐름 단위. 항상 'use-case'로 쓴다 (UseCase/usecase 금지).
  manager-proxy: src/modules/<domain>/proxy.ts. 단일 도메인 atomic helper.
  backend-proxy: src/service/backend-proxy.ts. 요청 단위 컨테이너.
---

# BackendService / BackendProxy 구현 가이드 (AI Agent)

> 이 문서는 AI 에이전트가 새 기능을 구현·리뷰·디버깅할 때 따르는 절차서다.  
> 모든 결정은 **§3 결정 규칙**과 **§9 Do/Don't**으로 환원된다. 모호하면 그쪽으로 돌아간다.
> 새 기능의 비즈니스 로직은 **`proxy.md`나 `src/modules/<domain>/proxy.ts`가 아니라 `src/lib/<domain>/` use-case 모듈에 구현**한다.
> 이 문서의 모든 샘플과 예시는 **`src/modules/mock` / `src/lib/mock` 기준**으로 읽는다. 프로젝트별 특화 도메인 구현은 작업 기준 샘플로 사용하지 않는다.

---

## §0. 시작 전: 어디부터 읽을 것인가

| 작업 유형 | 읽는 순서 |
|---|---|
| 새 기능 구현 | §1 → §2 → §3 → §4 → §9 |
| 기존 코드 리뷰 | §3 → §9 → §10 |
| 버그 수정 | §3 (위치 결정) → §6 (메서드) → §9 |
| 새 모델 추가 | §2-M → §9 |
| 개념 학습 | §10 → §5 → §7 |
| 빠른 룩업 | §11 (Task → Section) |

**경로 표기 약속**

- `<domain>`: 도메인 이름 (예: `mock`, `orders`, `tickets`)
- `<use-case>`: use-case 파일/폴더 이름 (예: `update-test-name`)
- `proxy.<domain>`: manager-proxy 인스턴스

**이 문서의 기본 샘플**

- 모델 source of truth: `src/modules/mock/model.ts`
- 모델 골든 샘플: `src/modules/mock/model.ts`의 `TestModel`
- manager-proxy 샘플: `src/modules/mock/proxy.ts`
- use-case 골든 샘플: `src/lib/mock/update-test-name.ts`
- spec 헤더 골든 샘플: `src/lib/mock/update-test-name.spec.ts`

`TestModel`의 `mockId + mock$`, `mockIds + mock$$`, `readonly $mock/$mocks` 패턴은 이 문서의 기준 계약이다.
이 계약을 바꾸는 경우 `model/views/transformer/proxy/spec/field-registry/guide`를 함께 갱신해야 한다.

---

## §1. 선조건 (PRECONDITION) — 만족 못하면 즉시 중단

유저가 다음 3가지를 제공했는지 확인한다. **하나라도 없으면 구현을 시작하지 말고 유저에게 요청한다.**

- [ ] **요구사항**: 비즈니스 흐름의 단계별 기술
- [ ] **Input**: 요청 파라미터 타입 또는 인터페이스 이름
- [ ] **Output**: 응답 타입 또는 인터페이스 이름

> **STOP 조건**: 위 3개가 모두 없을 때, "보통 이렇게 한다"로 추정해 시작하지 않는다.

---

## §2. 절차 (PROCEDURE)

### STEP 1. 파일 탐색 — 재사용 가능한 것을 먼저 식별

| 순서 | 파일 | 확인할 것 |
|---|---|---|
| 1 | `src/service/backend-proxy.ts` | 사용 가능한 manager-proxy |
| 2 | `src/modules/<domain>/proxy.ts` | 기존 helper (있으면 재사용) |
| 3 | `src/modules/<domain>/model.ts` | 필드 정의 (source of truth) |
| 4 | `src/lib/<domain>/` | 기존 use-case 목록 |

→ 객체 역할은 **§4 핵심 객체** 참고.

### STEP 2. SPEC.md 작성 — 구현 전 명세 고정

`src/lib/<domain>/SPEC.md` 또는 use-case 파일 상단 JSDoc에 작성한다.

- 기능 설명 1줄
- 비즈니스 STEP 목록 (§1 요구사항 기반)
- Input / Output 타입 명세
- 성공 시나리오 ≥ 1
- 실패 시나리오 (모델 없음, 권한 없음, validation 실패 등)

> **STOP 조건**: SPEC.md 없이 코드 작성을 시작하지 않는다.

#### mock 기준 최소 명세 예시

`updateTestName`의 경우 명세는 아래 정도면 충분하다.

- 기능 설명:
  - `TestModel.name`을 업데이트한다
  - 같은 요청에서 `count`를 항상 1 증가시킨다
- Input:
  - `id: string`
  - `name: string`
- Output:
  - 저장 후 최종 `TestModel`
- 성공 시나리오:
  - 기존 test-model이 있으면 `name`이 바뀌고 `count`가 1 증가한다
- 실패 시나리오:
  - `id` 없음
  - `name` 없음
  - 대상 model 없음

### STEP 3. 책임 분리 — proxy vs use-case

기본값은 **use-case 모듈**. 새 기능의 비즈니스 로직은 항상 use-case에서 시작한다.  
`proxy.md`/`proxy.ts`는 전체 기능 흐름을 담는 곳이 아니라 use-case가 호출하는 atomic helper를 설명·구현하는 곳이다. 아래 표로만 예외를 결정한다.

| 판단 기준 | 위치 |
|---|---|
| 새 기능의 비즈니스 흐름 (`validate → resolve → fetch → authorize → execute → return`) | `src/lib/<domain>/<use-case>.ts` |
| 여러 use-case에서 반복 호출되는 atomic helper (`saveMeta`, `loadMeta`) | `src/modules/<domain>/proxy.ts` |
| ID 생성, counter 증가, 단일 model mutation | `src/modules/<domain>/proxy.ts` |
| 하나의 API 흐름 전체 (resolve → fetch → authorize → execute → return) | `src/lib/<domain>/<use-case>.ts` |
| 여러 manager를 순서 있게 조합 | `src/lib/<domain>/<use-case>.ts` |

→ 추가 결정 규칙은 **§3 결정 규칙** 참고.

### STEP 4. 비즈니스 로직을 STEP으로 정렬

유저 요구사항을 다음 6단계 틀에 맞춘다 (모든 단계가 항상 필요한 건 아님).

```
STEP.0  validate   — 필수 입력값·전제 조건 확인
STEP.1  resolve    — 요청 주체 및 의존 리소스 해소
STEP.2  fetch      — 대상 조회 및 존재·유효성 검증
STEP.3  authorize  — 권한·비즈니스 조건 검증
STEP.4  execute    — 핵심 상태 변경 수행
STEP.5  return     — 결과 가공 및 반환
```

→ 실제 코드 형태는 **§7 use-case 예시** 참고.

### STEP 5. types.ts 작성

`src/lib/<domain>/<use-case>/types.ts` 또는 `src/lib/<domain>/types.ts`.

```ts
export interface <UseCaseName>Input { ... }   // 유저 제공 Input
export interface <UseCaseName>Output { ... }  // 유저 제공 Output
export interface <UseCaseName>Options { ... } // 실행 주입값만 ($owner, throwable, useSession 등)
```

> **STOP 조건**: `Options`에 비즈니스 입력값을 넣지 않는다. 요청 파라미터는 `Input`에 둔다.

단, 프론트엔드(React)와 공유해야 하는 API/use-case 타입은 `src/lib/<domain>/types.ts`가 아니라 `src/modules/<domain>/views.ts`에 둔다.
이렇게 해야 API와 frontend가 같은 domain view 계약을 import해서 타입 정보를 공유할 수 있다.

```ts
export interface UpdateTestNameInput {
    id: string;
    name: string;
}
```

### STEP 6. use-case 구현

파일: `src/lib/<domain>/<use-case>.ts` 또는 `<use-case>/execute.ts`.

- 시그니처: `(proxy: BackendProxy, input: Input, options?: Options) => Promise<Output>`
- STEP 4의 순서를 주석으로 표시
- Storage 접근은 `proxy.<domain>.*`로만
- proxy helper가 있으면 그걸 쓴다. 없으면 §6의 `get/set/inc` 조합
- 모델 정보를 업데이트할 때는 저장 직전에 항상 `proxy.<model>.validateModel(updateSet, id)`로 최종 점검한다.

#### STEP 6 내부 구현 절차

| # | 행동 | 참고 |
|---|---|---|
| 6.1 | 멱등성 판단 → 메서드 선택 (`get`/`set`/`inc`) | §6 |
| 6.2 | proxy helper 재사용 vs 신규 작성 결정 | §3 |
| 6.3 | §9 Do/Don't 위반 검사 | §9 |
| 6.4 | 위반 발견 시 해당 STEP으로 돌아가 수정 | — |

#### STEP 6 업데이트 저장 패턴

use-case에서 기존 모델 정보를 바꾸는 경우, 바로 `set()`에 body를 넘기지 않는다.
먼저 최종 업데이트 셋을 만들고, proxy validator로 참조 head와 모델 규칙을 마지막으로 보정한 뒤 저장한다.

```ts
// STEP.2 fetch
const test = await proxy.test.get(input.id, true);

// STEP.4 execute
const updateSet: TestModel = {
    name: input.name,
    mockId: input.mockId,
    mockIds: input.mockIds,
};

const validated = await proxy.test.validateModel(updateSet, test.id);
const saved = await proxy.test.set(test.id, validated);
```

이 패턴을 지키면 `mockId`, `mockIds`처럼 참조 id가 바뀌는 경우에도 proxy가 `mock$`, `mock$$`를 자동으로 다시 채운다.
`validateModel()` 전에는 use-case가 비즈니스 의도에 필요한 필드만 update set에 담고, head snapshot을 직접 조립하지 않는다.

### STEP 7. 테스트 작성 및 실행

`execute.spec.ts` 또는 `<use-case>.spec.ts`. 다음을 모두 커버한다.

- input validation 실패 (필수 필드 누락)
- 주요 성공 흐름 (SPEC.md 성공 시나리오)
- 핵심 실패 흐름 (모델 없음, 권한 없음 — SPEC.md 실패 시나리오)
- 저장 반영 여부 (`guardProxy()` 종료 후 `service.$<domain>.find/retrieve`로 확인)
- 헤더는 공통 spec 패턴 사용:

```ts
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { _it, describe, it, expect2, expect, GETERR } from '../../cores/commons.spec';
import * as $service from '../../service/backend-service.spec';

//* load target use-case function to verify.
import { myUseCase } from './my-use-case';
```

→ 상세 규칙은 **§8 테스트 규칙** 참고.

### STEP 8. Proxy 등록 및 API 연결

| # | 행동 |
|---|---|
| 8.1 | `src/lib/<domain>/index.ts`에 use-case를 export 하기 |
| 8.2 | 여러 API에서 재사용 시 `src/service/backend-proxy.ts`에 `<domain>`으로 포함 |
| 8.3 | `src/modules/<domain>/api-*.ts`의 `guardProxy()` 안에서 use-case 호출 |

> controller는 얇게 유지: request 정규화 + use-case 진입점만.

### STEP LAST. 자기검증 게이트

→ **§9 자기검증 체크리스트**를 모두 통과해야 완료. 위반 시 해당 STEP으로 복귀.

---

## §2-M. 신규 모델 추가 절차

신규 모델 추가는 use-case 구현과 별개의 작업으로 본다.
모델의 source of truth는 항상 `src/modules/<domain>/model.ts`이며, API 입출력은 `views.ts`와 `transformer.ts`에서 명시적으로 변환한다.

### STEP M1. 모델 타입과 LUT 등록

아래 순서로 타입 기준을 먼저 고정한다.

| 파일 | 해야 할 일 |
|---|---|
| `src/modules/<domain>/types.ts` | `ModelType`에 새 모델 타입 추가, 필요한 `*Stereo` LUT와 타입 추가 |
| `src/modules/<domain>/model.ts` | `<ModelName>Head`, `<ModelName>Model` 정의 |
| `src/modules/<domain>/model.ts` | `$HEAD`, `$FIELD`에 새 모델 연결 |

### STEP M2. BoolFlag 규칙

Storage/model 계층에서는 boolean을 직접 쓰지 말고 `BoolFlag`를 사용한다.

```ts
export interface MyModel extends Model {
    isActive?: BoolFlag;
}
```

반대로 외부 view/body 계층은 사람이 쓰는 API 계약이므로 boolean으로 노출한다.

```ts
export interface MyView extends View, Omit<Partial<MyModel>, 'isActive'> {
    isActive?: boolean;
}
```

변환은 반드시 transformer에서 처리한다.

```ts
// model -> view
isActive: model?.isActive !== undefined ? Boolean(model.isActive) : undefined,

// body -> model
if (body?.isActive !== undefined) model.isActive = $T.BN(body.isActive);
```

### STEP M3. Head 분리

다른 모델에서 참조하거나 socket/view/head payload로 줄 가능성이 있으면 `<ModelName>Head`를 별도로 둔다.
`stereo`가 있는 모델은 head에도 `stereo`를 항상 포함한다.

```ts
export interface MockHead {
    id?: string;
    name?: string;
    stereo?: MockStereo;
}

export interface MockModel extends Model, MockHead {
    meta?: string;
}
```

Head를 만들었으면 `$HEAD.<model>`에 등록하고 transformer에 `asHead()`를 둔다.

### STEP M4. 참조 필드와 배열 필드 규칙

모델 간 참조를 저장할 때는 ID만 저장하지 말고, 대응되는 head snapshot을 함께 저장한다.

```ts
export interface TestModel extends Model, TestHead {
    mockId?: string;
    mock$?: MockHead;

    mockIds?: string[];
    mock$$?: MockHead[];
}
```

ID 배열은 `xxxIds: string[]` 형태로 저장하고, 대응되는 head 배열은 `xxx$$` 형태로 저장한다.

```ts
export interface TestModel extends Model, TestHead {
    mockIds?: string[];
    mock$$?: MockHead[];
}
```

필요하면 전체 모델을 readonly `$xxx` 필드로 참조할 수 있다.
단, `$`로 시작하는 필드는 DB 저장 필드가 아니며 `$FIELD` 생성 시 제외된다.

```ts
export interface TestModel extends Model, TestHead {
    readonly $mock?: MockModel;
    readonly $mocks?: MockModel[];
}
```

작성 규칙:

- 단일 참조: `mockId + mock$`
- ID 배열: `mockIds`
- head 배열: `mock$$`
- 전체 모델 참조: `readonly $mock`, `readonly $mocks`
- `xxxIds$$`처럼 ID 배열에 `$$`를 붙이지 않는다.
- `xxx$` 또는 `xxx$$`는 head snapshot이고, `$xxx`는 전체 모델 참조다.

골든 샘플은 `src/modules/mock/model.ts`의 `TestModel`이다.

```ts
export interface TestModel extends Model, TestHead {
    mockId?: string;
    mock$?: MockHead;

    mockIds?: string[];
    mock$$?: MockHead[];

    readonly $mock?: MockModel;
    readonly $mocks?: MockModel[];
}
```

이 샘플은 `src/modules/mock/transformer.ts`와 `src/modules/mock/proxy.ts`에서도 같은 패턴으로 변환/검증된다.

### STEP M5. View/Body와 Transformer

`views.ts`에는 `<ModelName>View`, `<ModelName>Body`를 추가한다.
프론트엔드(React)와 공유되는 API/use-case 입력·출력 타입도 `views.ts`에 함께 둔다.
`transformer.ts`에는 `<ModelName>Transformer`를 만들고 `$trans.<model>`에 등록한다.

View에서 내부 객체 배열을 노출할 때는 model의 head 배열을 그대로 내보내지 말고, 대응되는 `<ModelName>View[]`로 변환한다.

```ts
export interface TestView extends View, Omit<Partial<TestModel>, 'mock$' | 'mock$$' | '$mock' | '$mocks'> {
    /** linked mock resolved from `mockId` */
    mock$?: MockView;
    /** linked mocks resolved from `mockIds` */
    mock$$?: MockView[];
}
```

ID 배열 입력은 body에서 `xxxIds`로 받고, transformer에서 `$T.SS(...).filter(Boolean)`으로 정규화한다.
`xxx$$`는 resolved view 출력 전용으로 보고 body 입력/저장 대상으로 처리하지 않는다.

```ts
// model -> view
mockIds: model?.mockIds,
mock$$: model?.mock$$ ? model.mock$$.map(N => $trans.mock.modelAsView(N)) : undefined,

// body -> model
if (body?.mockIds !== undefined) model.mockIds = $T.SS(body.mockIds).filter(Boolean);
```

Transformer에서는 모든 필드를 의식적으로 점검해야 한다.

- `modelAsView()`에서 외부로 노출할 필드를 빠짐없이 지정한다.
- `bodyToModel()`에서 body 입력을 모델 타입으로 변환한다.
- enum/stereo 값은 `$T.asLut()`로 검증한다.
- 문자열은 의미에 따라 `$T.S2()` 또는 `$T.S()`를 선택한다.
- 숫자는 `$T.N()`, boolean view 값은 `$T.BN()`으로 `BoolFlag`에 맞춘다.
- core/internal 필드, large field, readonly field를 외부에 노출할지 명시적으로 판단한다.
- Head가 있으면 `asHead()`가 `$HEAD.<model>` 기준으로 동작하는지 확인한다.
- 참조 필드는 `id`, `$`, `$$`, readonly `$xxx` 각각의 출력/입력 변환을 의식적으로 점검한다.

공유 API/use-case 타입 예:

```ts
export interface UpdateTestNameInput {
    id: string;
    name: string;
}
```

공유 타입은 특정 use-case 내부에서만 쓰는 private 타입이 아니라면 `src/lib/<domain>/types.ts`에 숨기지 않는다.

### STEP M6. Manager/Proxy/Service 등록

저장 가능한 모델이면 domain service와 proxy, top-level backend에 모두 연결한다.

| 파일 | 해야 할 일 |
|---|---|
| `src/modules/<domain>/service.ts` | `<ModelName>ModelManager` 추가, `BackendService` 인터페이스에 `$<model>` 추가 |
| `src/modules/<domain>/proxy.ts` | `<ModelName>ManagerProxy` 추가, domain `BackendProxy` 인터페이스에 `<model>` 추가 |
| `src/service/backend-service.ts` | `$<model>` manager 생성 |
| `src/service/backend-proxy.ts` | `<model>` proxy 생성 |

Manager와 Proxy의 책임은 분리한다.

- `service.ts`의 `ModelManager.validateModel()`은 필수값 등 최소 검증만 담당한다.
- `proxy.ts`의 `ManagerProxy.validateModel()`은 `this.$mgr.validateModel(model, $org)`를 먼저 호출한다.
- proxy 검증에서는 API smoke/internal test용으로 `name === '#'`, create 시 `name === '!'`를 막는다. 단, `name` 필드가 없는 모델에는 억지로 적용하지 않는다.
- 단일 참조 id가 body/update에 들어오면 대응 head를 다시 읽어 `xxx$`를 갱신한다.
- id 배열이 body/update에 들어오면 대응 모델들을 `mget()`으로 읽어 `xxx$$`를 갱신한다.
- 참조 id가 빈 값이면 head는 `null`, id 배열이 빈 값이면 head 배열은 `[]`로 정규화한다.

표준 proxy 패턴:

```ts
public async validateModel<T extends TestModel>(model: T, modelId?: string): Promise<T> {
    const $org = modelId ? await this.get(modelId, true) : null;
    const isCreate = !$org;
    const validated = await this.$mgr.validateModel(model, $org);

    const errScope = `validate(${this.$mgr.type}/${modelId ?? ''})`;
    if (validated?.name == '#') throw new Error(`.name[${validated.name}] is invalid - ${errScope}`);
    if (isCreate && validated?.name == '!') throw new Error(`.name[${validated.name}] is invalid - ${errScope}`);

    if (validated?.mockId !== undefined) {
        const mock = validated.mockId ? await this.proxy.mock.get(validated.mockId, false) : null;
        validated.mock$ = mock ? this.proxy.mock.trans.asHead(mock) : null;
    }

    if (validated?.mockIds !== undefined) {
        const mocks = validated.mockIds?.length ? await this.proxy.mock.mget(validated.mockIds, false) : [];
        validated.mock$$ = mocks?.filter(Boolean).map(N => this.proxy.mock.trans.asHead(N)) ?? [];
    }

    return validated as T;
}
```

### STEP M7. fieldKeys 갱신

`$HEAD`와 `$FIELD`는 `src/generated/field-registry.ts`의 `fieldKeys`를 사용하므로 모델 추가 후 반드시 생성 파일을 갱신한다.

```sh
npm run fields:gen
```

생성 후 아래를 확인한다.

- `fieldKeys.<model>Head()`가 추가됐는가?
- `fieldKeys.<model>Model()`이 추가됐는가?
- `fieldRegistryMeta.entryCount`와 `checksum`이 함께 갱신됐는가?

### STEP M8. Transformer Spec

최소한 transformer spec에서 아래를 검증한다.

- `$FIELD.<model>`에 저장 대상 필드가 들어오는가?
- `bodyToModel()`이 body 값을 모델 타입으로 변환하는가?
- `modelAsView()`가 모든 view 필드를 의도대로 출력하는가?
- `BoolFlag` 필드는 view에서 boolean으로 보이는가?
- `asHead()`가 head 필드만 반환하는가?
- 참조 규칙이 지켜지는가? 예: `mockId + mock$`, `mockIds + mock$$`, `readonly $mocks`
- `xxxIds$$` 같은 잘못된 ID 배열 필드명이 남아 있지 않은가?

Transformer spec은 `mock-model`, `test-model` 테스트처럼 모델별 구역을 분리한다.

```ts
//* test of `test-model`
it('should pass test-model', async () => {
    const FIELD = $FIELD.test;
    const trans = $trans.test;
    const $model: TestModel = { ... };

    //* immutable.
    const $imune: TestModel = {
        mock$: undefined,
        mock$$: undefined,
        $mocks: undefined,
    };

    expect2(() => checkAllKeys($model, FIELD)).toEqual([]);
    expect2(() => trans.bodyToModel(onlyDefined(trans.modelAsView($model)))).toEqual({
        ...$model,
        ...$imune,
    });
});
```

Spec 작성 규칙:

- 여러 모델을 한 `it()`에 묶지 않는다.
- 각 모델마다 `FIELD`, `trans`, `$model`, `$imune`를 둔다.
- proxy/service spec에서 `makeModel()`을 사용할 때는 `makeModel<TestModel>()`처럼 모델 generic을 명시한다.
- `$imune`에는 API body로 업데이트/저장하면 안 되는 필드를 명시한다.
- `mock$`, `mock$$` 같은 head snapshot은 `$imune`에 넣어 `bodyToModel()` 저장 대상에서 제외되는지 검증한다.
- `readonly $mocks` 같은 전체 모델 참조도 `$imune`에 넣어 저장 대상이 아님을 검증한다.

---

## §3. 결정 규칙 (DECISION RULES)

### 3.1 기능을 어디에 둘 것인가

| 상황 | 위치 |
|---|---|
| 새 기능의 비즈니스 로직 | `src/lib/<domain>` use-case |
| 단순 조회 | `service.$<domain>` 또는 `proxy.<domain>.get/find` |
| `guardProxy()` 바깥에서 최종 저장 결과 확인 | `service.$<domain>.find/retrieve` |
| 단일 model 변경 | `proxy.<domain>.set/inc` |
| 단일 도메인 atomic helper | `src/modules/<domain>/proxy.ts` |
| 여러 manager를 순서 있게 조합 | `src/lib/<domain>` use-case |
| WebSocket agent처럼 한 곳에서만 호출 | use-case 직접 import 허용 |
| request/event parsing | `src/modules/<domain>/api-*.ts` 또는 event handler |

### 3.2 proxy helper 재사용 vs 신규 작성

| 판단 | 행동 |
|---|---|
| `proxy.<domain>.<helper>()` 시그니처가 이미 있다 | 그걸 쓴다. 재구현 금지 |
| 같은 atomic mutation이 이 use-case 이후에도 반복될 것 같다 | `ManagerProxy`에 helper 추출 후 사용 |
| 이 use-case에서만 쓰는 비즈니스 판단·분기·흐름이다 | use-case 파일 안에서 직접 구현 |
| 새 API 기능의 전체 흐름을 추가해야 한다 | `ManagerProxy`가 아니라 use-case를 만든다 |

`mock` 기준 예:

- `updateTestName`에서만 필요한 `name 변경 + count 증가` 흐름은 `src/lib/mock/update-test-name.ts`에 둔다
- 만약 이후 여러 use-case가 반복해서 `meta 저장`을 쓴다면 기존 `proxy.test.saveMeta()` 같은 helper를 재사용한다

### 3.3 직접 import

| 조건 | 선택 |
|---|---|
| 호출자가 이미 `BackendProxy`를 가짐 + 호출 지점 1~2곳 + 재사용 가능성 낮음 | **직접 import** (예: 단일 migration, 내부 helper 진입점) |

---

## §4. 핵심 객체 (CONCEPTS)

> 절차에 막혔을 때만 펼쳐 본다. 일반 흐름에는 §2가 충분하다.

### BackendService

- 위치: `src/service/backend-service.ts`
- 책임: 도메인 manager 생성, `createProxy(context)`로 `BackendProxy` 생성, `guardProxy()` 제공
- AI 읽는 기준: 등록된 `$<domain>` 목록 / `guardProxy()` 바깥 결과 확인용 `service.$<domain>.find/retrieve`
- 이 문서의 샘플에서는 `service.$test`, `service.$mock`만 기준으로 본다

### BackendProxy

- 위치: `src/service/backend-proxy.ts`
- 책임: 요청 단위 실행 컨텍스트, manager-proxy 접근점
- AI 읽는 기준: `proxy.<domain>` manager 목록 / **`guardProxy()` 안에서는 항상 `proxy.<domain>` 사용 (`service.$<domain>` 금지)**
- 이 문서의 샘플에서는 `proxy.test`, `proxy.mock`만 기준으로 본다

### ManagerProxy

- 위치: `src/modules/<domain>/proxy.ts`
- 책임: 단일 도메인 model의 atomic 동작, `get/set/inc` 공통 + 도메인 helper
- 비책임: 새 기능의 전체 비즈니스 흐름, 여러 단계의 권한/존재 검증, 여러 manager 조합
- AI 읽는 기준: 새 helper 추가 전 기존 helper 존재 확인. 단일 model의 ID/조회/저장/counter 로직은 보통 여기. 기능 흐름은 `src/lib/<domain>/` use-case로 이동한다.

### ApiController

- 위치: `src/modules/<domain>/api-*.ts`
- 책임: path/query/body/event parsing, transformer 정규화, entrypoint 정책 해소, `guardProxy()` 시작, use-case 결과 반환
- AI 읽는 기준: 같은 도메인 기존 `api-*.ts` naming/패턴을 따른다. 긴 business flow는 controller에 두지 않는다.

### UseCase

- 위치: `src/lib/<domain>/`
- 책임: 여러 `proxy.*` 호출 조합, 권한/존재 검증, mutation, view 변환
- AI 읽는 기준: `types.ts`에서 계약 / `execute.ts`에서 STEP 순서 / `index.ts`에서 export 등록.

### guardProxy()

- 위치: `src/cores/abstract-services.ts` (대개)
- 시그니처: `guardProxy<T>(context: NextContext, callback: (proxy: Proxy) => Promise<T>): Promise<T>`
- 동작: proxy 생성 → callback 실행 → 종료 시 `saveAllUpdates()` 자동 호출
- 규칙:
  - 안에서 읽기/쓰기는 `proxy.*`로 통일
  - 안에서 새 `BackendService` 생성 금지
  - 예외 시에도 `saveAllUpdates()` 1회 시도 후 throw 가능 (서비스 구현 확인)

---

## §5. 표준 사용 흐름

```ts
return this.service.guardProxy($ctx, async proxy => {
    const model = await proxy.test.get('A00001', {});
    const updateSet = { name: 'updated name' };
    const validated = await proxy.test.validateModel(updateSet, 'A00001');
    await proxy.test.set('A00001', validated);
    return model;
});
```

1. `guardProxy()`가 `NextContext`로 `BackendProxy` 생성
2. callback 안에서 `proxy.*`로 조회/수정
3. callback 종료 → `proxy.saveAllUpdates()`
4. 누적 변경사항 Storage 반영

---

## §6. ManagerProxy 메서드 (`get` / `set` / `inc`)

### 6.1 멱등성 → 메서드 선택

| 상황 | 사용 메서드 |
|---|---|
| 카운터·순번·tick 증가 (재시도 시 두 번 더해야 정상) | `inc()` |
| atomic claim (반환값 1로 선점 판별) | `inc()` + 반환값 검증 |
| upsert (없으면 기본값, 있으면 덮어쓰기) | `get({}) → set()` |
| 필드 덮어쓰기 (이미 조회된 모델 확정 상태) | `set()` |
| 반드시 있어야 하는 모델 조회 | `get(true)` |
| 없어도 되는 조회 | `get(false)` |

### 6.2 `get()`

```ts
await proxy.test.get('A00001', true);   // 없으면 throw
await proxy.test.get('A00001', false);  // 없으면 null
await proxy.test.get('A00001', {});     // 없으면 기본 모델로 시작
```

- `false`로 받으면 `null`일 수 있음. 바로 필드 대입 금지.
- `{}`로 받으면 read-modify-write 시작점으로 자연스럽게 이어짐.

### 6.3 `set()`

```ts
const updateSet = { name: 'new name' };
const validated = await proxy.test.validateModel(updateSet, 'A00001');
await proxy.test.set('A00001', validated);
```

- 부분 업데이트. 실제 Storage 반영은 `guardProxy()` 종료 시점.
- use-case에서 모델 정보를 업데이트하는 경우 `set()` 직전에 `validateModel(updateSet, id)`를 반드시 거친다.

### 6.4 `inc()`

```ts
const test = await proxy.test.inc('A00001', { count: 1 });
```

- 숫자 누적이 의도일 때. atomic counter 성격 있을 때.

### 6.5 도메인 helper 우선순위

1. 도메인 helper 있으면 helper 사용
2. 없으면 `get/set/inc` 조합
3. 같은 mutation 반복 → `ManagerProxy` helper로 추출
4. 여러 manager 묶는 흐름 → use-case로 분리

`mock` 기준 helper 예:

- `proxy.test.loadMeta(id)`
- `proxy.test.saveMeta(id, meta)`
- `proxy.mock.pushMockBody(body)`
- `proxy.mock.pullMockBody(id)`

helper 탐색 시 읽을 파일:

- `src/modules/<domain>/proxy.ts`
- `src/modules/<domain>/model.ts`

---

## §7. use-case 구현 패턴

### 7.1 계약 (`src/lib/core/index.ts`)

```ts
import type { BackendProxy } from '../../service/backend-proxy';

export type UseCase<I = any, O = any, P = void> = (
    proxy: BackendProxy,
    input: I,
    options?: P,
) => Promise<O>;

```

규칙:

- 첫 인자는 항상 `proxy`
- 둘째 인자는 business input
- 셋째 인자는 실행 옵션 (`$owner`, `useSession`, `throwable`, `current`, `validate`, `errScope`)
- Storage 접근은 `proxy.<domain>`으로만
- request body 도메인 값은 `input`, 실행 환경 값은 `options`

### 7.2 표준 예시 (`mock/update-test-name.ts`)

```ts
export const updateTestName: UseCase<UpdateTestNameInput, UpdateTestNameOutput, UpdateTestNameOptions> = async (
    proxy,
    input,
) => {
    const errScope = `updateTestName(${input?.id ?? ''})`;

    // STEP.0 validate
    if (!input?.id) throw new Error(`.id (string) is required - ${errScope}`);
    if (!input?.name) throw new Error(`.name (string) is required - ${errScope}`);

    // STEP.1 fetch
    const model = await proxy.test.get(input.id, true);

    // STEP.2 execute
    const updateSet = { name: input.name };
    const validated = await proxy.test.validateModel(updateSet, model.id);
    await proxy.test.set(model.id, validated);
    await proxy.test.inc(model.id, { count: 1 });

    // STEP.3 return
    return proxy.test.get(model.id, true);
};
```

작성 기준:

- 파일 1개 = use-case 1개
- 단계는 `STEP.1`부터 순서대로. validation/normalization은 `STEP.0`
- 에러 메시지에 `errScope` 포함 → spec 회귀 검증 용이
- 흐름이 한눈에: validate → fetch → mutation → return
- side effect / non-goal은 파일 상단 JSDoc에 짧게

### 7.3 UseCase 등록 (`src/lib/<domain>/index.ts`)

```ts
export * from './types';
export * from './update-test-name';
```

### 7.4 mock 도메인 기준 파일 연결

```ts
src/modules/mock/model.ts            // TestModel, MockModel source of truth
src/modules/mock/proxy.ts            // MockManagerProxy, TestManagerProxy helper
src/lib/mock/types.ts                // UpdateTestNameInput / Output / Options
src/lib/mock/update-test-name.ts     // use-case 구현
src/lib/mock/update-test-name.spec.ts // 독립 spec
src/lib/mock/index.ts                // export 정리
```

### 7.5 직접 import (예외 경로)

```ts
import { updateTestName } from '../../lib/mock';

return this.service.guardProxy($ctx, async proxy => {
    return updateTestName(proxy, { id: body.id, name: body.name });
});
```

→ 허용 조건은 §3.3 참고.

### 7.6 API/Handler 패턴

```ts
return this.service.guardProxy($ctx, async proxy => {
    return updateTestName(proxy, { id: body.id, name: body.name });
});
```

- API/handler에 두는 것: parsing, normalization, entrypoint 정책, `guardProxy()` 시작, use-case 호출
- API/handler에 두지 않는 것: 긴 business flow, model mutation 상세, atomic helper, 반복 권한/존재 검증

### 7.7 Codex 작업 지침용 최소 레시피

새 코덱스가 바로 따라야 하는 기본 순서는 아래다.

1. `src/modules/<domain>/model.ts`에서 필드 확인
2. `src/modules/<domain>/proxy.ts`에서 helper 존재 여부 확인
3. `src/lib/<domain>/types.ts`에 input/output/options 정의
4. `src/lib/<domain>/<use-case>.ts`에 `UseCase` 시그니처로 구현
5. `src/lib/<domain>/<use-case>.spec.ts`에 공통 헤더 패턴으로 독립 spec 작성
6. API/controller에서는 `guardProxy()` 안에서 use-case만 호출

`mock` 기준으로는 아래 두 파일을 먼저 복사 기준으로 삼으면 된다.

- `src/lib/mock/update-test-name.ts`
- `src/lib/mock/update-test-name.spec.ts`

---

## §8. 테스트 규칙

- use-case마다 `execute.spec.ts` 또는 `<use-case>.spec.ts`
- 커버: input validation, 주요 성공, 핵심 실패, 저장 반영
- 헤더는 `commons.spec` + `backend-service.spec` 기반 공통 패턴을 유지
- error string은 `GETERR` 같은 헬퍼로 고정 검증
- `guardProxy()` 안에서 변경한 내용은 callback 이후 `service.$<domain>.find/retrieve`로 확인
- 기존 `BackendProxy` 메서드를 추출했다면 기존 통합 spec 유지 (회귀 방지)

`mock/update-test-name.spec.ts`가 보여주는 최소 검증 세트:

- 성공:
  - 기존 model의 `name`이 변경된다
  - `count`가 1 증가한다
  - `service.$test.find()`로 저장 반영을 확인한다
- 실패:
  - `name` 누락
  - 대상 model 없음

---

## §9. Do / Don't

| Do | Don't |
|---|---|
| 새 기능 비즈니스 로직은 `src/lib/<domain>` use-case로 구현 | 새 기능 흐름을 `proxy.md`/`src/modules/<domain>/proxy.ts`에 구현 |
| `guardProxy()` 안 작업은 `proxy.*`로 | `guardProxy()` 안에서 `service.$<domain>`로 중간 상태 확인 |
| use-case는 `(proxy, input, options?)` 시그니처 | use-case 안에서 새 `BackendService` 생성 |
| model 필드는 `modules/<domain>/model.ts` 기준 | request body를 model 필드로 가정 |
| model boolean 저장 필드는 `BoolFlag` 사용 | model에 `boolean` 직접 저장 |
| view/body boolean 변환은 `transformer.ts`에서 처리 | model과 view의 boolean 표현을 섞기 |
| 프론트엔드 공유 API/use-case 타입은 `views.ts`에 작성 | 공유 타입을 `src/lib/<domain>/types.ts`에 숨기기 |
| transformer에서 모든 필드 출력/입력 변환을 점검 | 새 필드를 model에만 추가하고 view 변환 누락 |
| 필요한 참조 payload는 `<ModelName>Head`로 분리 | full model을 head/reference로 그대로 노출 |
| 참조 ID는 대응 head와 함께 저장 (`mockId + mock$`) | 참조 ID만 저장하고 head snapshot 누락 |
| ID 배열은 `xxxIds`, head 배열은 `xxx$$` 사용 | `xxxIds$$`처럼 ID 배열에 `$$` 붙이기 |
| 전체 모델 참조는 readonly `$xxx` 사용 | `$xxx` 필드가 DB에 저장된다고 가정 |
| head snapshot과 readonly 참조는 transformer `$imune`로 저장 불가 검증 | `bodyToModel()`에서 `stage$`, `note$$`, `$notes` 저장 허용 |
| `stereo`가 있는 모델은 head에도 `stereo` 포함 | head에서 stereo 누락 |
| 모델 추가 후 `npm run fields:gen` 실행 | `fieldKeys`를 수동 편집하거나 갱신 누락 |
| 여러 manager 조합은 `src/lib/<domain>` | `api-*.ts`에 긴 business flow 작성 |
| atomic helper는 `ManagerProxy` | 같은 mutation 로직을 use-case마다 복사 |
| `options`에는 실행 주입값만 | `options`에 business input 필드 섞기 |

### 자기검증 체크리스트 (LAST 게이트)

- [ ] SPEC.md의 모든 시나리오가 spec에서 통과하는가?
- [ ] 새 기능 비즈니스 로직이 `src/lib/<domain>` use-case에 있는가?
- [ ] `guardProxy()` 내부 작업을 `proxy.*`로만 하고 있는가?
- [ ] use-case 시그니처가 `(proxy, input, options?)`인가?
- [ ] controller가 business flow를 직접 나열하지 않는가?
- [ ] atomic helper가 `ManagerProxy`에 있는가?
- [ ] `options`에 비즈니스 입력값이 섞여 있지 않은가?
- [ ] 저장 결과를 `guardProxy()` 종료 후 `service.$<domain>.find/retrieve`로 확인했는가?
- [ ] 프론트엔드와 공유하는 API/use-case 타입이 `src/modules/<domain>/views.ts`에 있는가?
- [ ] 새 모델 boolean 저장 필드가 `BoolFlag`이고 view/body에서는 boolean으로 변환되는가?
- [ ] 새 모델의 `transformer.ts`가 모든 필드의 출력과 입력 변환을 명시적으로 다루는가?
- [ ] 새 모델에 필요한 `<ModelName>Head`와 `asHead()`가 있는가?
- [ ] 참조 필드는 `id + $head`, 배열은 `ids + $$heads`, 전체 모델은 readonly `$xxx` 패턴인가?
- [ ] head snapshot과 readonly 참조가 `bodyToModel()` 저장 대상에서 제외되고 `$imune` spec으로 검증되는가?
- [ ] `stereo`가 있는 모델의 head에 `stereo`가 포함되는가?
- [ ] 새 모델 추가 후 `npm run fields:gen`으로 `fieldKeys`가 갱신됐는가?

위반 항목이 있으면 해당 STEP으로 돌아가 수정 후 spec 재실행.

---

## §10. Core 개념 요약

- `BackendService`는 모델 manager를 소유한다.
- `BackendProxy`는 요청 컨텍스트와 함께 각 manager의 proxy를 묶는다.
- 비즈니스 로직과 Storage 갱신은 `guardProxy()` 내부에서 처리한다.
- `guardProxy()` 종료 시 변경사항이 Storage에 반영된다.
- 여러 manager를 조합하는 반복 업무는 `src/lib/<domain>/` use-case로 분리한다.
- API/handler는 request 정규화와 `guardProxy()` 시작만 담당한다.

---

## §11. Task → Section 빠른 룩업

| 하려는 일 | 보는 곳 |
|---|---|
| 새 모델 만들기 | §2-M |
| 새 use-case 만들기 | §2 STEP 4~6, §7.1~7.2 |
| `get/set/inc` 어떤 걸 쓸지 | §6.1 |
| 코드 위치 결정 (proxy vs use-case) | §3.1, STEP 3 |
| 테스트 케이스 빠짐 검사 | §8, STEP 7 |
| 리뷰/PR 자기검증 | §9 체크리스트 |
| guardProxy 동작 원리 | §4 guardProxy(), §5 |
| 도메인 helper 어디서 찾나 | §6.5 |

---

## §A. 프로젝트 구조 템플릿

```sh
src/
├── service/
│   ├── backend-service.ts      # BackendService: manager 소유, guardProxy 제공
│   └── backend-proxy.ts        # BackendProxy: 요청 단위 proxy 
├── modules/
│   └── <domain>/
│       ├── api-<resource>.ts   # API/controller
│       ├── model.ts            # model 필드 source of truth
│       ├── proxy.ts            # ManagerProxy
│       ├── service.ts          # domain service 또는 helper
│       ├── transformer.ts      # request/view 변환
│       ├── types.ts            # ModelType, Stereo LUT
│       └── views.ts            # 응답 view 기준
└── lib/
    ├── core/
    │   └── index.ts            # UseCase 공통 타입
    └── <domain>/
        ├── README.md 또는 SPEC.md
        ├── index.ts
        └── <use-case>.ts 또는 <use-case>/execute.ts
```

평평한 구조 (간단한 use-case):

```sh
src/lib/mock/
├── README.md
├── index.ts
├── types.ts
├── update-test-name.ts
└── update-test-name.spec.ts
```

폴더 구조 (use-case가 늘어날 때):

```sh
src/lib/mock/
├── SPEC.md
├── index.ts
└── update-test-name/
    ├── types.ts
    ├── execute.ts
    └── execute.spec.ts
```

---

## §B. Reference Mapping

| 패턴 | 위치 | 읽을 포인트 |
|---|---|---|
| 원본 proxy 실행 모델 | `docs/backend-service-proxy.md` | `BackendService`, `BackendProxy`, `ManagerProxy`, `guardProxy()` 기본 |
| mock 골든 샘플 use-case | `src/lib/mock/update-test-name.ts` | `UseCase` 시그니처, `get/set/inc` 조합, errScope 패턴 |
| mock 골든 샘플 spec | `src/lib/mock/update-test-name.spec.ts` | 공통 spec 헤더, `$service.instance()`, 성공/실패/저장 검증 |

---

## §C. 완료 기준 (DEFINITION OF DONE)

- [ ] 새 기능이 `guardProxy()` 실행 경계 안에서 동작
- [ ] 새 기능 비즈니스 로직이 `src/lib/<domain>` use-case 모듈에 구현됨
- [ ] Storage 접근은 `proxy.<domain>`으로 수행
- [ ] 반복 비즈니스 흐름은 `src/lib/<domain>` use-case로 분리
- [ ] `src/modules/<domain>/api-*.ts`는 request 정규화 + use-case 호출 중심으로 얇음
- [ ] use-case input/output/options 타입이 가까운 파일에 존재
- [ ] 프론트엔드와 공유되는 API/use-case 타입은 `src/modules/<domain>/views.ts`에 존재
- [ ] 새 모델이면 `types.ts`, `model.ts`, `views.ts`, `transformer.ts`, `service.ts`, `proxy.ts`, top-level backend 등록이 일관됨
- [ ] 새 모델의 boolean 저장 필드는 `BoolFlag`, view/body 노출은 boolean, 변환은 transformer에 있음
- [ ] 새 모델의 참조 필드는 `xxxId + xxx$`, `xxxIds + xxx$$`, readonly `$xxx` 규칙을 따름
- [ ] `stereo`가 있는 모델은 head에도 `stereo`를 포함함
- [ ] 새 모델의 모든 출력/입력 필드를 transformer spec으로 검증함
- [ ] 새 모델 추가 후 `npm run fields:gen` 결과가 반영됨
- [ ] 단위 spec과 필요한 통합 spec 통과
