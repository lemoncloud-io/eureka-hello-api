# Serverless Framework — 이 저장소에서는 유지

lemon-hello-api는 2026-10-31에 Serverless Framework 패키지와 `sls` 스크립트를 지웠다. 이 저장소는 지우지 않는다.
다른 배포 프로필(`ssocio`·`muzly`·`epyt`)과 기본 프로필의 prod가 아직 `sls`로 배포하기 때문이다. 이 스택들은 lemon-core의 검토된 이관 대상이 아니다.

-   `serverless`, 플러그인 3개(`serverless-aws-documentation`·`serverless-plugin-log-retention`·`serverless-prune-plugin`), `@cruglobal/serverless-merge-config`를 `devDependencies`에 남긴다.
-   `sls`를 부르는 스크립트(`deploy*`·`pack*`·`info*`·`logs*`·`remove*`)를 모두 남긴다. `serverless.yml`도 그대로다.
-   호출·로그·성능 점검·pack·배포 계획·dev 이관은 lemon-core의 `lemon-*` 명령이 맡는다([lambda-tools.md](lambda-tools.md)).

## 스테이지별 배포 경로

| 프로필               | 스테이지  | 소유                         | 배포                                                                             |
| -------------------- | --------- | ---------------------------- | -------------------------------------------------------------------------------- |
| 기본(`profile=none`) | dev       | 배포 서비스(2026-11-01 이관) | `lambda:deploy` `code` 모드. lemon-core #266 게시 뒤 `lambda:deploy:dev`도 된다. |
| 기본(`profile=none`) | prod      | Serverless                   | `deploy.prod`                                                                    |
| `ssocio`             | prod      | Serverless                   | `deploy.ssocio`                                                                  |
| `muzly`              | dev, prod | Serverless                   | `deploy.muzly`, `deploy.muzly.prod`                                              |
| `epyt`               | dev, prod | Serverless                   | `deploy.epyt`, `deploy.epyt.prod`                                                |

-   모든 계정에서 스택 이름은 `eureka-hello-api-<stage>`다. 계정은 `--aws-profile`(또는 셸 자격 증명)이 정한다.
-   `deploy`·`remove`는 사람만 실행한다. prod는 특히 그렇다.

## 이관된 dev(기본 프로필)에는 쓰지 않는 스크립트

| 스크립트 | 이유                                                                                | 대신                            |
| -------- | ----------------------------------------------------------------------------------- | ------------------------------- |
| `deploy` | 새 Serverless 스택을 만들려 한다. 배포 서비스가 관리하는 함수·자원과 이름이 겹친다. | `lambda:pack` → `lambda:deploy` |
| `remove` | 지울 Serverless 스택이 없다.                                                        | 없음                            |
| `info`   | `sls info`가 볼 Serverless 스택이 없다.                                             | `lambda:invoke -- --path /`     |
| `logs`   | 함수 로그는 그대로지만 `lemon-*` 도구가 표준이다.                                   | `lambda:logs`                   |
| `pack`   | `sls package`는 배포하지 않는다. 이관된 dev의 ZIP은 `lambda:pack`이 만든다.         | `lambda:pack`                   |

## npm audit

-   Serverless 경로의 권고가 남는다. 2026-11-01 기준 전체 52건 중 18건(high 4·critical 4 포함)이 Serverless 패키지로만 닿는다. 나머지 34건은 `minimatch` 권고(moderate, eslint·jest·nodemon 사슬)다.
-   `npm audit --omit=dev`는 0이다. Serverless 패키지는 dev 의존성이라 Lambda ZIP에 들어가지 않는다.
-   모든 프로필이 배포 서비스로 옮기면 lemon-hello-api `docs/serverless.md`처럼 지운다.
