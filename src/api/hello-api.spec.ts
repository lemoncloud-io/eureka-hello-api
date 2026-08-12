/**
 * `hello-api.spec.ts`
 * - sample unit test for `hello-api`
 *
 *
 * @author      Steve Jung <steve@lemoncloud.io>
 * @date        2024-11-27 initial version with `lemon-core#3.2.10`
 *
 * @copyright (C) lemoncloud.io 2024 - All Rights Reserved. (https://eureka.codes)
 */
import { expect2, loadJsonSync, $U } from 'lemon-core';
import { HelloAPIController } from './hello-api';
import * as $service from '../service/hello-service.spec';
import { SlackService } from '../service/slack-service';
import { SlackChannelModel, StorageSupportable } from '../service/slack-types';
import { HelloService } from '../service/hello-service';

import { app } from '../express';
import request from 'supertest';

// create service instance
export const instance = (type: 'dummy' = 'dummy') => {
    const { service, current } = $service.instance(type);
    const controller = new HelloAPIController(service);
    return { controller, service, current };
};

//*main test body.
describe('hello-controller', () => {
    const $pack = loadJsonSync('package.json');

    // basic test
    it('check type and identity of controller', async () => {
        const { controller } = instance();
        expect2(controller.type()).toEqual(`hello`);
        expect2(controller.hello()).toEqual(`hello-api-controller:${controller.type()}`);
    });

    it('should pass express route: GET /', async () => {
        const res = await request(app).get('/');
        expect2(() => ({ ...res, text: res.text.split('\n')[0] })).toMatchObject({
            status: 200,
            text: `${$pack.name}/${$pack.version}`,
        });
    });

    it(`should pass GET /hello/0`, async () => {
        const expected = { name: '1st', id: '0' };
        const res = await request(app).get(`/hello/0`);
        expect2(res).toMatchObject({
            status: 200,
            text: $U.json({ ...expected }),
        });
    });

    it('should pass channel save/read w/ chatic fields and token masking', async () => {
        const $channel = new (class implements StorageSupportable<SlackChannelModel> {
            public $map: { [id: string]: SlackChannelModel } = {};
            public hello = () => `dummy-channel-storage`;
            public async read(id: string) {
                return this.$map[id] || null;
            }
            public async save(id: string, model: SlackChannelModel) {
                const $old = this.$map[id];
                const $fin = model === null ? null : { ...$old, ...model };
                if ($fin === null) delete this.$map[id];
                else this.$map[id] = $fin;
                return $fin;
            }
        })();
        const service = { $slack: new SlackService($channel) } as unknown as HelloService;
        const controller = new HelloAPIController(service);
        const id = 'chatic1';

        //* save a chatic channel.
        const saved = await controller.doPostChannel(
            id,
            {},
            {
                endpoint: 'https://example.com/hello/chat-send',
                stereo: 'chatic',
                channelId: 'C001',
                token: 'super-secret-1234',
            },
            { domain: 'localhost' },
        );
        expect2(saved).toEqual({
            channel: id,
            endpoint: 'https://example.com/hello/chat-send',
            stereo: 'chatic',
            channelId: 'C001',
            token: 'super-secret-1234',
        });

        //* read via non-local context -> endpoint/token masked. (existing endpoint convention)
        expect2(await controller.doGetChannel(id, {}, undefined, { domain: 'test.com' })).toEqual({
            channel: id,
            endpoint: 'https://exam',
            stereo: 'chatic',
            channelId: 'C001',
            token: '****1234',
        });

        //* read via local context -> unmasked.
        expect2(await controller.doGetChannel(id, {}, undefined, { domain: 'localhost' })).toEqual({
            channel: id,
            endpoint: 'https://example.com/hello/chat-send',
            stereo: 'chatic',
            channelId: 'C001',
            token: 'super-secret-1234',
        });

        //* update w/ routing rules -> merged into the model. (consumed by `SlackService.route()`)
        const updated = await controller.doPostChannel(
            id,
            {},
            { rules: [{ pattern: '/./', copyTo: 'error' }] },
            { domain: 'localhost' },
        );
        expect2(updated, 'rules').toEqual({ rules: [{ pattern: '/./', copyTo: 'error' }] });

        //* no channel -> routed via `public` so its routing rules apply. (auto error-report path)
        const sent: { endpoint: string; message: any }[] = [];
        (service.$slack as any).postMessage = async (endpoint: string, message: any) => {
            sent.push({ endpoint, message });
            return { statusCode: 100, statusMessage: 'ok' };
        };
        await controller.doPostChannel(
            'public',
            {},
            { endpoint: 'http://slack.example.com', rules: [{ pattern: '/./', copyTo: id }] },
            { domain: 'localhost' },
        );
        await controller.doPostSlack('0', {}, { attachments: [{ title: 'T' }] }, { domain: 'localhost' });
        expect2(() => sent.map(N => N.endpoint)).toEqual([
            'https://example.com/hello/chat-send',
            'http://slack.example.com',
        ]);
        expect2(() => sent[0].message, 'channelId,stereo').toEqual({ channelId: 'C001', stereo: 'webhook' });

        //* no id but `body.channel` -> respected over the `public` fallback. (see jsdoc of `doPostSlack`)
        sent.length = 0;
        await controller.doPostSlack('0', {}, { text: 'hello', channel: id }, { domain: 'localhost' });
        expect2(() => sent.map(N => N.endpoint)).toEqual(['https://example.com/hello/chat-send']);
    });
});
