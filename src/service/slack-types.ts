/**
 * interface: `StorageSupportable<T>`
 * - storage supportable interface.
 */
export interface StorageSupportable<T> {
    /** say hello */
    hello?(): string;

    /**
     * get model by id
     * - can return null if not found.
     */
    read(id: string): Promise<T | null>;

    /**
     * save(or update) model by id
     * - null data means delete the model.
     * - get the final model saved.
     *
     * @returns the final model saved (can be null if deleted).
     */
    save(id: string, data?: T): Promise<T | null>;
}

/**
 * type: `RouteRule`
 *
 *
 * @see SlackPostBody
 */
export interface RouteRule {
    /** regular express to match */
    pattern: string;

    /**
     * copy contents to target channel.
     * - duplicate the attachments
     * - ignored if it is in same channel
     * ex) A -> A + B
     */
    copyTo?: string;

    /**
     * move channel to other one.
     * - change the `.channel` in `SlackPostBody`
     * ex) A -> B
     */
    moveTo?: string;

    /** override `color` of `SlackAttachment` */
    color?: string;

    /**
     * forward the input message to other
     * = id of `TargetModel`
     */
    forward?: string;
}

export interface SlackChannelModel {
    /**
     * id of channel
     */
    id?: string;

    /**
     * (optional) redirected `channel` name in slack.
     * - `id` would be channel.
     */
    channel?: string;

    /** (optional) readable name of this channel */
    name?: string;

    /**
     * route rules in sequence.
     */
    rules?: RouteRule[];

    /**
     * target address (URL)
     */
    endpoint?: string;
}
