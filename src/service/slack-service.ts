/**
 * `slack-service.ts`
 * - common service for `slack` messaging
 *
 *
 * @author      Steve Jung <steve@lemoncloud.io>
 * @date        2025-10-24 optimized from `lemon-hello-api`
 *
 * @copyright (C) lemoncloud.io 2025 - All Rights Reserved. (https://eureka.codes)
 */
import { $U, _log } from 'lemon-core';
import { SlackChannelModel, StorageSupportable } from './slack-types';
const NS = $U.NS('slack', 'blue'); // NAMESPACE TO BE PRINTED.

/**
 * class: `SlackService`
 * - common service for `slack` messaging
 */
export class SlackService {
    /**
     * default constructor.
     *
     * @param $channel storage supportable for slack channel model.
     */
    public constructor(public readonly $channel: StorageSupportable<SlackChannelModel>) {
        if (!$channel) throw new Error(`$channel (StorageSupportable<SlackChannelModel>) is required - SlackService()`);
    }

    /**
     * hello.
     */
    public hello = () => `slack-service:${this.$channel?.hello() ?? '-'}`;

    /**
     * get channel by id
     * - can return null if not found.
     */
    public async channel(id: string, $def?: SlackChannelModel): Promise<SlackChannelModel | null> {
        const errScope = `slack.channel(${id ?? ''})`;
        if (!id) throw new Error(`@id (channel) is required - ${errScope}`);
        const $org = await this.$channel?.read(id);
        if (!$org && $def) {
            return await this.$channel?.save(id, $def);
        }
        return $org;
    }
}
