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
import { asChaticContent, asChaticPayload } from './chatic-transformer';
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
                $sent: { statusCode: 100, statusMessage: 'ok', body: { channel: 'public', text: 'hello' } },
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

        //* test `asChaticContent()`/`asChaticPayload()` - pure conversion from slack body to chatic payload.
        if (1) {
            expect2(() => asChaticContent({ text: 'hello' })).toEqual('hello');
            expect2(() => asChaticContent({})).toEqual('');
            //* w/ attachments -> summary lines only: `title` -> `pretext` in order.
            expect2(() =>
                asChaticContent({
                    text: 'hello',
                    attachments: [
                        {
                            pretext: '401 UNAUTHORIZED - not authenticated @invite.list',
                            title: 'error-report: `chatic-sockets-api/lemon-production#0.26.710`',
                            text: 'X',
                            fields: [{ title: 'F', value: 1 }],
                        },
                    ],
                }),
            ).toEqual(
                'error-report: `chatic-sockets-api/lemon-production#0.26.710`\n' +
                    '401 UNAUTHORIZED - not authenticated @invite.list',
            );

            //* long/object `text` never inlined - summary only (full payload is delegated to `meta.sourceUrl`).
            expect2(() =>
                asChaticPayload({ attachments: [{ pretext: 'P', title: 'T', text: { a: 1 } as any }] }),
            ).toEqual({ content: 'T\nP', stereo: 'webhook', meta: { pretext: 'P', title: 'T' } });
            expect2(() => asChaticContent({ attachments: [{ title: 'T', text: 'x'.repeat(501) }] })).toEqual('T');

            //* edge: no title/pretext -> falls back to a short attachment text (500 chars boundary kept).
            expect2(() => asChaticContent({ attachments: [{ text: 'only-text' }] })).toEqual('only-text');
            expect2(() => asChaticContent({ attachments: [{ text: 'x'.repeat(500) }] })).toEqual('x'.repeat(500));
            expect2(() => asChaticContent({ attachments: [{ text: 'x'.repeat(501) }] })).toEqual('');

            //* edge: all empty -> `meta` itself is omitted.
            expect2(() => asChaticPayload({})).toEqual({ content: '', stereo: 'webhook' });

            //* w/o attachments -> `meta.text` falls back to `body.text` (only field body carries).
            expect2(() => asChaticPayload({ text: 'hi' })).toEqual({
                content: 'hi',
                stereo: 'webhook',
                meta: { text: 'hi' },
            });

            //* w/ attachments -> `meta` extracted from the first attachment (representative), incl. `footer`.
            expect2(() =>
                asChaticPayload({
                    text: 'hello',
                    attachments: [
                        {
                            pretext: 'P',
                            title: 'T',
                            text: 'X',
                            color: 'danger',
                            username: 'hello-alarm',
                            ts: 1755000000,
                            footer: 'chatic-sockets-api/lemon-production#0.26.710',
                            fields: [
                                { title: 'F', value: 1 },
                                { title: '', value: 'v2' },
                            ],
                        },
                    ],
                }),
            ).toEqual({
                content: 'T\nP',
                stereo: 'webhook',
                meta: {
                    pretext: 'P',
                    title: 'T',
                    text: 'X',
                    color: 'danger',
                    username: 'hello-alarm',
                    ts: 1755000000,
                    footer: 'chatic-sockets-api/lemon-production#0.26.710',
                    fields: [{ title: 'F', value: 1 }, { value: 'v2' }],
                },
            });

            //* w/ `sourceUrl` -> carried in `meta.sourceUrl` only (not in `content` - app renders the link).
            expect2(() => asChaticPayload({ text: 'hi' }, { sourceUrl: 'https://s3.example.com/o.json' })).toEqual({
                content: 'hi',
                stereo: 'webhook',
                meta: { text: 'hi', sourceUrl: 'https://s3.example.com/o.json' },
            });

            //* w/ `token` -> carried in the body (no headers), omitted if not given.
            expect2(() => asChaticPayload({ text: 'hi' }, { token: 'secret-token' })).toEqual({
                content: 'hi',
                stereo: 'webhook',
                token: 'secret-token',
                meta: { text: 'hi' },
            });
        }

        //* test `send()` branching to `chatic` channel - transform body, carrying the service token in body.
        if (1) {
            const calls: { endpoint: string; message: any }[] = [];
            (service as any).postMessage = async (endpoint: string, message: any) => {
                calls.push({ endpoint, message });
                return { statusCode: 100, statusMessage: 'ok', body: message };
            };

            //* chatic channel w/ token -> converted body incl. `token`.
            await service.$channel.save('chatic1', {
                endpoint: 'http://example.com/chat-send?channelId=C001',
                stereo: 'chatic',
                token: 'secret-token',
            });
            await service.send({ text: 'hello' }, { channel: 'chatic1' });
            expect2(calls.pop()).toEqual({
                endpoint: 'http://example.com/chat-send?channelId=C001',
                message: {
                    content: 'hello',
                    stereo: 'webhook',
                    token: 'secret-token',
                    meta: { text: 'hello' },
                },
            });

            //* chatic channel w/o token -> converted body, no `token` field.
            await service.$channel.save('chatic2', {
                endpoint: 'http://example.com/chat-send2?channelId=C002',
                stereo: 'chatic',
            });
            await service.send({ text: 'hi' }, { channel: 'chatic2' });
            expect2(calls.pop()).toEqual({
                endpoint: 'http://example.com/chat-send2?channelId=C002',
                message: {
                    content: 'hi',
                    stereo: 'webhook',
                    meta: { text: 'hi' },
                },
            });

            //* chatic channel w/ `$s3s` configured -> uploads original message, carries `meta.sourceUrl` only.
            const s3Calls: { json: string }[] = [];
            const $s3s = {
                bucket: () => 'test-bucket',
                putObject: async (json: string) => {
                    s3Calls.push({ json });
                    return { Bucket: 'test-bucket', Key: 'k.json', Location: 'https://s3.example.com/k.json' } as any;
                },
            } as any;
            const service2: SlackService = new (class extends SlackService {
                constructor() {
                    super(service.$channel, { $s3s });
                }
                public postMessage = async (endpoint: string, message: any) => {
                    calls.push({ endpoint, message });
                    return { statusCode: 100, statusMessage: 'ok', body: message };
                };
            })();
            await service2.send({ text: 'hello' }, { channel: 'chatic1' });
            expect2(() => JSON.parse(s3Calls.pop()?.json)).toEqual({ channel: 'chatic1', text: 'hello' });
            expect2(calls.pop()).toEqual({
                endpoint: 'http://example.com/chat-send?channelId=C001',
                message: {
                    content: 'hello',
                    stereo: 'webhook',
                    token: 'secret-token',
                    meta: {
                        text: 'hello',
                        sourceUrl: 'https://s3.example.com/k.json',
                    },
                },
            });

            //* `$s3s.putObject()` failing -> send proceeds w/o `sourceUrl` (no url, unchanged content/meta).
            const $s3sFail = {
                bucket: () => 'test-bucket',
                putObject: async () => {
                    throw new Error('put-failed');
                },
            } as any;
            const service3: SlackService = new (class extends SlackService {
                constructor() {
                    super(service.$channel, { $s3s: $s3sFail });
                }
                public postMessage = async (endpoint: string, message: any) => {
                    calls.push({ endpoint, message });
                    return { statusCode: 100, statusMessage: 'ok', body: message };
                };
            })();
            await service3.send({ text: 'hi' }, { channel: 'chatic2' });
            expect2(calls.pop()).toEqual({
                endpoint: 'http://example.com/chat-send2?channelId=C002',
                message: {
                    content: 'hi',
                    stereo: 'webhook',
                    meta: { text: 'hi' },
                },
            });

            //* no `stereo` (slack, existing) -> unchanged body. (no-regression)
            await service.$channel.save('slack1', { endpoint: 'http://example.com/slack1' });
            await service.send({ text: 'hi' }, { channel: 'slack1' });
            expect2(calls.pop()).toEqual({
                endpoint: 'http://example.com/slack1',
                message: { channel: 'slack1', text: 'hi' },
            });

            //* explicit `stereo: 'slack'` -> same as default slack path. (no-regression)
            await service.$channel.save('slack2', { endpoint: 'http://example.com/slack2', stereo: 'slack' });
            await service.send({ text: 'hi' }, { channel: 'slack2' });
            expect2(calls.pop()).toEqual({
                endpoint: 'http://example.com/slack2',
                message: { channel: 'slack2', text: 'hi' },
            });
        }
    });
});
