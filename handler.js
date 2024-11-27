/**
 * `handler.js`
 * - handler to be exported for serverless.
 * - ONLY FOR Lambda Deployment.
 *
 *
 * @author      Steve Jung <steve@lemoncloud.io>
 * @date        2024-11-27 initial version with `lemon-core#3.2.10`
 *
 * @copyright (C) lemoncloud.io 2024 - All Rights Reserved. (https://eureka.codes)
 */
/** ********************************************************************************************************************
 *  Serverless API Handlers
 *  - optimized to export handler functions for serverless.
 *  - mainly export API handler which is includes in main loader.
 ** *******************************************************************************************************************/
//NOTE - 다음이 있어야, Error 발생시 ts파일에서 제대로된 스택 위치를 알려줌!!!.
require('source-map-support').install();

// COMMON ENVIRONMENT LOADER
const $env = process.env || {}; // NOTE! - serverless may initialize environment with opt.

//*SETUP TIMEZONE @2019/03/14
$env.TZ = 'Asia/Seoul';

//*TARGET SOURCE FOLDER.
const SRC = $env.SRC || './dist/';

//*load configuration.
const engine = require(`${SRC}index`).engine;
const $engine = engine();
if (!$engine || !$engine.lambda) throw new Error('.lambda (function) is required! check lemon-core#3.2.10');

//*export as serverless handlers.
module.exports = $engine;
