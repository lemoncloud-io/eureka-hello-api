# Serverless Framework — 쓰지 않음, 권장 구성 기록

2026-11-03부터 이 저장소는 Serverless Framework 패키지를 설치하지 않는다. `sls`·`serverless`를 부르는 스크립트도 없다(모든 프로필·스테이지). 오너 결정이다(2026-11-03).
호출·로그·성능 점검·패키징·배포 계획·dev 코드 배포는 lemon-core의 `lemon-*` 명령이 맡는다([lambda-tools.md](lambda-tools.md), [lambda-migrate.md](lambda-migrate.md)).

## 남겨 둔 파일

| 파일                        | 왜 남기나                                                                                                                                                                                |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `serverless.yml`            | 로컬 서버가 쓴다. lemon-core `buildExpress()`의 로컬 API Gateway가 이 파일의 `http` 이벤트로 라우트를 만든다. `lemon-*` 도구는 `service:` 줄을 읽는다. 이관 전 스택(아래 표)의 기록이다. |
| `swagger/documentation.yml` | `serverless-aws-documentation` 플러그인 설정. 이관 전 스택의 기록이다.                                                                                                                   |
| `env/`                      | 프로필 설정. 에이전트는 열지 않는다.                                                                                                                                                     |

-   `serverless.yml`의 `plugins:` 목록도 그대로다. 패키지가 없으면 `sls` 명령만 동작하지 않는다.
-   라우트를 바꾸면 `serverless.yml`을 고친다. 로컬 서버가 그 라우트를 따른다. 이관된 dev의 라우트는 배포 서비스가 관리한다.

## 지금 상태

| 프로필               | 스테이지  | 소유                         | 배포 경로                                                                                                   |
| -------------------- | --------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 기본(`profile=none`) | dev       | 배포 서비스(2026-11-01 이관) | `lambda:pack` → `lambda:deploy` `code` 모드, 또는 `lambda:deploy:dev`. 한 명령은 `deploy:dev`. 사람만 실행. |
| 기본(`profile=none`) | prod      | Serverless (이관 전)         | npm 스크립트 없음. 아래 `npx` 구성. 사람만 실행.                                                            |
| `ssocio`             | prod      | Serverless (이관 전)         | npm 스크립트 없음. 아래 `npx` 구성. 사람만 실행.                                                            |
| `muzly`              | dev, prod | Serverless (이관 전)         | npm 스크립트 없음. 아래 `npx` 구성. 사람만 실행.                                                            |
| `epyt`               | dev, prod | Serverless (이관 전)         | npm 스크립트 없음. 아래 `npx` 구성. 사람만 실행.                                                            |

-   모든 계정에서 스택 이름은 `eureka-hello-api-<stage>`다. 계정은 `--aws-profile`(또는 셸 자격 증명)이 정한다.
-   기본 프로필 prod와 다른 프로필의 스택은 lemon-core의 검토된 이관 대상이 아니다. 이관 전에는 이 저장소에 그 배포 스크립트가 없다.

## Serverless로 직접 실행해야 하면 (`npx`, devDependency 없음)

아래는 지울 때의 구성이다. 이 저장소에서 마지막으로 설치된 조합이다. `devDependencies`에 다시 넣지 않는다.

| 패키지                               | 선언 범위 | 마지막 설치판 |
| ------------------------------------ | --------- | ------------- |
| `serverless`                         | `^3.19.0` | 3.40.0        |
| `serverless-aws-documentation`       | `^0.8.0`  | 0.8.0         |
| `serverless-plugin-log-retention`    | `^2.1.0`  | 2.1.0         |
| `serverless-prune-plugin`            | `^2.0.1`  | 2.0.1         |
| `@cruglobal/serverless-merge-config` | `^1.1.0`  | 1.1.0         |

`serverless.yml`의 플러그인은 서비스 폴더의 `node_modules`에서 찾는다. 그래서 플러그인은 저장하지 않고 설치하고, CLI만 `npx`로 부른다. `npx -y serverless@3.40.0`은 Serverless 3을 그때 내려받는다.

```sh
# plugins into node_modules only; package.json and package-lock.json stay unchanged
npm i --no-save serverless-aws-documentation@0.8.0 serverless-plugin-log-retention@2.1.0 serverless-prune-plugin@2.0.1 @cruglobal/serverless-merge-config@1.1.0
# build first, as the removed deploy scripts did
npm run build
# then one of the per-profile commands below (human only, explicit profile)
# return node_modules to the lock afterwards
npm ci
```

지운 스크립트와 같은 플래그다(`--param='profile=<p>' --stage <s> --aws-profile <p>`). 기본 프로필은 지운 스크립트처럼 `--aws-profile`이 없다(셸 자격 증명).

| 대상          | 배포 (`npm run build` 뒤)                                                                    |
| ------------- | -------------------------------------------------------------------------------------------- |
| 기본 prod     | `npx -y serverless@3.40.0 deploy --param='profile=none' --stage prod`                        |
| `ssocio` prod | `npx -y serverless@3.40.0 deploy --param='profile=ssocio' --stage prod --aws-profile ssocio` |
| `muzly` dev   | `npx -y serverless@3.40.0 deploy --param='profile=muzly' --stage dev --aws-profile muzly`    |
| `muzly` prod  | `npx -y serverless@3.40.0 deploy --param='profile=muzly' --stage prod --aws-profile muzly`   |
| `epyt` dev    | `npx -y serverless@3.40.0 deploy --param='profile=epyt' --stage dev --aws-profile epyt`      |
| `epyt` prod   | `npx -y serverless@3.40.0 deploy --param='profile=epyt' --stage prod --aws-profile epyt`     |

`info`·`logs`·`remove`·`package`도 같은 플래그로 `deploy` 자리에 넣는다. 지운 `logs.*`는 `-t --startTime 5m -f <fn>`을 붙였다(`ssocio`는 `-f backend`, 나머지는 `-f lambda`).

-   이 절차는 기록이다. 2026-11-03 변경에서 돌려 보지 않았다(에이전트는 AWS를 부르지 않는다).
-   Serverless Framework 3.x 기준이다. 4.x는 로그인·라이선스 방식이 달라 검증하지 않았다.
-   `serverless-offline`은 Node 22 이상에서 실패해 이미 꺼져 있다(`serverless.yml` 주석). 로컬 실행은 `npm run express`다.
-   `deploy`·`remove`는 사람만 실행한다. 에이전트는 사람이 명시적으로 시킬 때만 돌린다. prod는 특히 그렇다.
-   기본 프로필 dev에는 `sls deploy`·`sls remove`를 쓰지 않는다. 함수가 배포 서비스 소유다(2026-11-01 이관).

## 지운 스크립트가 실제로 가리키던 대상

이름만 보고 대상을 짐작하면 틀리는 곳이 있었다. 위 `npx` 명령을 만들 때 이름이 아니라 이 표를 따른다. 지운 스크립트를 다시 만들지 않는다.

| 프로필           | 지운 스크립트                                                   | 실제 대상                                                                        |
| ---------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 기본             | `deploy.prod`·`pack.prod`·`info.prod`·`logs.prod`·`remove.prod` | prod. `--aws-profile` 없음 — 셸 자격 증명을 썼다                                 |
| 기본             | `deploy`·`remove`                                               | dev 가드(`scripts/migrated-stage-guard.mjs`, 실패로 끝남). `sls`를 부르지 않았다 |
| `ssocio`         | 모든 스크립트(`deploy`·`pack`·`info`·`logs`·`remove`)           | prod(dev 스크립트 없음)                                                          |
| `muzly`          | `deploy.muzly` / `deploy.muzly.prod`                            | dev / prod                                                                       |
| `muzly`          | `pack.muzly`·`info.muzly`·`logs.muzly`·`remove.muzly`           | dev                                                                              |
| `epyt`           | `deploy.epyt` / `deploy.epyt.prod`                              | dev / prod                                                                       |
| `epyt`           | `pack.epyt`·`info.epyt`·`logs.epyt`·`remove.epyt`               | prod(`deploy.epyt`는 dev)                                                        |
| `ssocio`·`muzly` | `pack.*`                                                        | `--aws-profile` 없음 — 셸 자격 증명을 썼다                                       |

## 지운 것과 대신 쓰는 명령

| 지운 스크립트 (`<profile>`: `ssocio`·`muzly`·`epyt`)       | 하던 일          | 지금                                                                                     |
| ---------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------- |
| `deploy`, `remove` (기본 dev)                              | dev 가드(exit 1) | 필요 없음. 부를 `sls` 스크립트가 없다. 가드 파일도 지웠다. dev는 `lambda:*`·`deploy:dev` |
| `deploy.prod`, `deploy.<profile>`, `deploy.<profile>.prod` | `sls deploy`     | 위 `npx` 구성(이관 전)                                                                   |
| `pack.prod`, `pack.<profile>`                              | `sls package`    | `npm run lambda:pack` (`lemon-lambda-pack`)                                              |
| `info.prod`, `info.<profile>`                              | `sls info`       | 대응 명령 없음. 동작 확인은 `lambda:invoke`. 스택 정보가 필요하면 위 `npx` 구성          |
| `logs.prod`, `logs.<profile>`                              | `sls logs`       | `npm run lambda:logs` (`lemon-lambda-logs`, `--fn backend`도 된다)                       |
| `remove.prod`, `remove.<profile>`                          | `sls remove`     | 대응 명령 없음                                                                           |

dev 가드가 사라진 이유: 가드는 예전 습관대로 `npm run deploy`·`npm run remove`를 치면 이유와 대신 쓸 명령을 보여 주려고 두었다(2026-11-01). 이제 `sls` 스크립트가 하나도 없어서 가드가 막을 것이 없다.

지운 devDependencies는 위 패키지 표의 다섯 개다. 그 효과(2026-11-03 실측):

-   `npm audit`(전체) 12 → 0건. 지우기 전 12건(critical 4·high 4·moderate 4)은 모두 Serverless 패키지로만 닿았다.
-   `npm audit --omit=dev`는 그대로 0이다.
-   `node_modules` 481 MB → 283 MB. lock에서 425개 항목(`packages`, 1220 → 795)이 빠졌다. 버전이 바뀐 패키지는 없다.
