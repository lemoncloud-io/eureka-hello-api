/**
 * `slack-service.spec.ts`
 * - common service for `slack-service`
 *
 *
 * @author      Steve Jung <steve@lemoncloud.io>
 * @date        2025-10-24 optimized from `lemon-hello-api`
 *
 * @copyright (C) lemoncloud.io 2024 - All Rights Reserved. (https://eureka.codes)
 */
import { expect2, GETERR } from 'lemon-core';

//* import main models and service.
import { SlackService } from './slack-service';
import { SlackChannelModel, SlackResponse, StorageSupportable } from './slack-types';

//*create service instance.
export const instance = (options?: { current?: number }) => {
    const current = options?.current ?? new Date().getTime();
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
    const service: SlackService = new (class extends SlackService {
        constructor() {
            super($channel);
        }
        /** dummy postMessage */
        public postMessage = async (endpoint: string, message: any): Promise<SlackResponse> => {
            return { statusCode: 100, statusMessage: 'ok', body: message };
        };
    })();
    return { service, current };
};

//*main test body.
describe('slack-service /w dummy', () => {
    it('should pass hello()', async () => {
        // const PROFILE = loadProfile(process); // override process.env.
        // PROFILE && console.info(`! PROFILE =`, PROFILE);
        const { service } = instance();
        expect2(() => service?.hello()).toEqual('slack-service:dummy-channel-storage');

        expect2(await service.channel('').catch(GETERR)).toEqual('@id (channel) is required - slack.channel()');
        expect2(await service.channel('nonexist').catch(GETERR)).toEqual(null);

        expect2(await service.channel('usedefault', { name: 'default' }).catch(GETERR)).toEqual({ name: 'default' });
        expect2(await service.channel('usedefault', { name: 'nexttry' }).catch(GETERR)).toEqual({ name: 'default' });
        expect2(await service.channel('usedefault').catch(GETERR)).toEqual({ name: 'default' });

        expect2(await service.$channel.save('usedefault', { channel: 'x' }).catch(GETERR)).toEqual({
            name: 'default',
            channel: 'x',
        });

        expect2(await service.channel('public').catch(GETERR)).toEqual(null);
        expect2(await service.default()).toEqual({ channel: 'public' });

        //* test send() with various channel determination.
        if (1) {
            const endpoint = 'http://example.com/slack';
            expect2(await service.send({ text: 'hello' })).toEqual({
                channel: 'public',
                $sent: {
                    statusCode: 0,
                    statusMessage: '@endpoint(string) is required in channe[public] - slack.send(/)',
                },
            });
            expect2(await service.$channel.save('public', { endpoint })).toEqual({ endpoint });

            //* determine the channel in order: param.channel > message.channel > default.channel
            expect2(await service.send({ text: 'hello' })).toEqual({
                channel: 'public',
                $sent: { statusCode: 100, statusMessage: 'ok', body: { text: 'hello' } },
                endpoint,
            });
            expect2(await service.send({ text: 'hello' }, { channel: 'test' })).toEqual({
                channel: 'test',
                $sent: { statusCode: 100, statusMessage: 'ok', body: { channel: 'test', text: 'hello' } },
                endpoint,
            });
            expect2(await service.send({ text: 'hello' }, { channel: 'public' })).toEqual({
                channel: 'public',
                $sent: { statusCode: 100, statusMessage: 'ok', body: { channel: 'public', text: 'hello' } },
                endpoint,
            });
            expect2(await service.send({ text: 'hello', channel: 'test' })).toEqual({
                channel: 'public',
                $sent: { statusCode: 100, statusMessage: 'ok', body: { channel: 'test', text: 'hello' } },
                endpoint,
            });
            expect2(await service.send({ text: 'hello', channel: 'test' }, { channel: 'public' })).toEqual({
                channel: 'public',
                $sent: { statusCode: 100, statusMessage: 'ok', body: { channel: 'public', text: 'hello' } },
                endpoint,
            });
            expect2(await service.send({ text: 'hello', channel: 'public' })).toEqual({
                channel: 'public',
                $sent: { statusCode: 100, statusMessage: 'ok', body: { channel: 'public', text: 'hello' } },
                endpoint,
            });
            expect2(await service.send({ text: 'hello', channel: 'public' }, { channel: 'test' })).toEqual({
                channel: 'test',
                $sent: { statusCode: 100, statusMessage: 'ok', body: { channel: 'test', text: 'hello' } },
                endpoint,
            });
        }
    });
});
