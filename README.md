# eureka-hello-api

Simple MicroService over Serverless Cloud with [lemon-core](https://github.com/lemoncloud-io/lemon-core).
Nothing to manage at all, just run and go.

## Description

- Sample boilerplate to develop the servlesss API based on `Nodejs` + `Typescript`
- Use `DynamoDB` as the main storage.

## Usage

- Pre requirements (or installations) before starting.

    1. [aws-cli](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) with api-key
    2. [git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
    3. [nodejs22](https://nodejs.org/ko/blog/release/v22.11.0)
    4. (optional) [httpie](https://httpie.io/docs/cli/installation)

- Fork(or clone), develop and deploy the serverless api.

    ```bash
    # clone the sample code.
    $ git clone https://github.com/lemoncloud-io/eureka-hello-api.git

    # STEP.1 install the dependecies.
    $ npm ci

    # STEP.2 run the server locally.
    $ npm run express

    # STEP.3 make request and develop locally.
    $ http :8000/hello

    # STEP.4 deploy into your AWS cloud (`AWS-Key` is required).
    $ npm run deploy

    # (example) use AWS authorized call.
    $ http --auth-type aws4 https://7s91yrozci.execute-api.ap-northeast-2.amazonaws.com/dev/hello/0 name=world

    # STEP.5 check the deploy info (`AWS-Key` is required).
    $ npm run info

    # STEP.6 remove(or uninstall) (`AWS-Key` is required).
    $ npm run remove
    ```

- Use AWS profile to deploy and manage the serverless api.

    ```bash
    # if you already configured AWS profile.
    $ aws configure --profile myprofile

    # STEP.1 deploy with specific AWS profile.
    $ AWS_PROFILE=myprofile npm run deploy

    # (example) use AWS authorized call.
    $ http --auth-type aws4 https://{your_deployed_api_id}.execute-api.ap-northeast-2.amazonaws.com/dev/hello/0 name=world

    # STEP.2 check the deploy info with specific AWS profile.
    $ AWS_PROFILE=myprofile npm run info

    # STEP.3 remove(or uninstall) with specific AWS profile.
    $ AWS_PROFILE=myprofile npm run remove
    ```

## LICENSE

[MIT](http://opensource.org/licenses/MIT)

------------------

## VERSION INFO ##

Version History

| Version   | Description
|--         |--
| 0.24.511  | optimized with `lemon-core#3.2.15`.
| 0.24.1127 | initial version with `lemon-core#3.2.10`.

<!-- lemon-devkit:proxy-doc:start -->
## Proxy

`lemon-devkit@0.0.12`부터 install/upgrade 시 consumer project의 `docs/proxy-implementation-guide.md`와 `README.md`에 proxy 구현 가이드를 자동 반영한다.
Proxy 기능을 추가하거나 변경할 때는 [lemon-devkit proxy implementation guide](docs/proxy-implementation-guide.md)를 먼저 확인한다.
`BackendProxy`, `ManagerProxy`, `guardProxy()` 계열 동작과 프로젝트 적용 절차는 이 문서 기준으로 맞춘다.
<!-- lemon-devkit:proxy-doc:end -->
