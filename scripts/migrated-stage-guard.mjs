#!/usr/bin/env node
//* v5 B29: blocks a Serverless `deploy` / `remove` of the default-profile dev stack, which the deploy service owns since 2026-11-01.
const [action = 'deploy', stage = 'dev'] = process.argv.slice(2);
// the replacement command for each blocked action (`remove` has none: there is no Serverless stack to remove).
const instead = action === 'deploy' ? 'npm run lambda:pack, then npm run lambda:deploy (code mode)' : 'none';
// one message on stderr, then a failing exit so `npm run deploy` / `npm run remove` stop here.
console.error(
    [
        `[blocked] sls ${action} --stage ${stage} (default profile): this stack was migrated to the deploy service on 2026-11-01.`,
        `A Serverless ${action} would try to own functions and resources the deploy service now manages.`,
        `Instead: ${instead}. See docs/serverless.md.`,
    ].join('\n'),
);
process.exit(1);
