"use strict";var _typeof="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e};exports=module.exports=function(s,e){if(!s)throw new Error("_$(global instance pool) is required!");s._;var p=s.U;if(!p)throw new Error("$U is required!");var h=p.NS(e||"GOOD","yellow"),y=s.log,m=(s.inf,s.err);function b(e){return v(404,e)}function E(e){return v(503,e)}function v(e,t){return{statusCode:e,headers:{"Content-Type":"string"==typeof t?"text/plain; charset=utf-8":"application/json; charset=utf-8","Access-Control-Allow-Origin":"*","Access-Control-Allow-Credentials":!0},body:"string"==typeof t?t:JSON.stringify(t)}}var t=function(e,t,r){t.callbackWaitsForEmptyEventLoop=!1;var o=e.queryStringParameters||{},n=e.pathParameters||{},i=decodeURIComponent(n.type||""),s=decodeURIComponent(n.id||""),l=(s||"GET"!==e.httpMethod?e.httpMethod:"LIST")||"",c=decodeURIComponent(n.cmd||e.action||""),u=l&&{LIST:"LIST",GET:"GET",PUT:"PUT",POST:"POST",DELETE:"DELETE"}[l]||(e.Records?"EVENT":e.Sns?"SNS":"CRON"),a=e.body&&("string"==typeof e.body&&(e.body.startsWith("{")||e.body.startsWith("["))?JSON.parse(e.body):e.body)||e.Records&&{records:e.Records}||null;!a&&y(h,"#"+u+":"+c+" ("+l+", "+i+"/"+s+")...."),a&&y(h,"#"+u+":"+c+" ("+l+", "+i+"/"+s+").... body.len=",a?p.json(a).length:-1);var d={_id:s,_param:o,_body:a,_event:e,_ctx:t};d._ctx=e&&e.requestContext||d._ctx;var f=Promise.resolve(d),_=function(e,t,r){var o=null;switch(e){case"LIST":o=T;break;case"GET":o=S;break;case"PUT":o=g;break;case"POST":o=O;break;case"DELETE":o=P}return o}(u);if(!_)return r(null,b({MODE:u}));try{f.then(function(e){var t=e._id,r=e._param,o=e._body,n=e._ctx;return _(t,r,o,n)}).then(function(e){return e&&"object"===(void 0===e?"undefined":_typeof(e))&&(e=p.cleanup(e)),r(null,v(200,e)),!0}).catch(function(e){return m(h,"!!! callback@1 with err",e),0<=(e&&e.message||"").indexOf("404 NOT FOUND")?r(null,b(e.message)):r(null,E(e.message||e)),!1})}catch(e){r(e,E(e.message))}};t.do_list_hello=T,t.do_get_hello=S,t.do_put_hello=g,t.do_post_hello=O,t.do_delete_hello=P;var l=[{name:"lemon"},{name:"cloud"}];function T(e,t,r,o){y(h,"do_list_hello("+e+")....");var n={};return n.name=s.environ("NAME"),Promise.resolve(n).then(function(e){return e.list=l,e})}function S(e,t,r,o){y(h,"do_get_hello("+e+")....");var n=p.N(e,0),i=l[n];return i?Promise.resolve(i).then(function(e){var t=Object.assign({},e);return t._id=n,t}):Promise.reject(new Error("404 NOT FOUND - id:"+n))}function g(e,t,r,o){return y(h,"do_put_hello("+e+")...."),t=t||{},S(e).then(function(e){return e=Object.assign(e,r||{})})}function O(e,t,r,o){return y(h,"do_post_hello("+e+")...."),t=t||{},r||r.name?Promise.resolve(r).then(function(e){return l.push(e),l.length-1}):Promise.reject(new Error(".name is required!"))}function P(e,t,r,o){return y(h,"do_delete_hello("+e+")...."),S(e).then(function(e){return void 0===e._id?Promise.reject(new Error("._id is required!")):(delete l[i],e)})}return t};