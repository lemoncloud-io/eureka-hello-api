/**
 * `chatic-transformer.ts`
 * - pure conversion from `SlackMessage` to `chatic` webhook payload.
 *
 *
 * @author      Aiden <aiden@lemoncloud.io>
 * @date        2026-08-12 initial version
 *
 * @copyright (C) lemoncloud.io 2026 - All Rights Reserved.
 */
import { onlyDefined } from 'lemon-core';
import type { SlackMessage } from './slack-service';
import type { ChaticWebhookMeta } from './slack-types';

/** max length to keep a `text` inline — longer details are delegated to `sourceUrl`. */
const TEXT_LIMIT = 500;

/**
 * keep only a short string text — non-string(object) or long details are dropped.
 * - chat shows key lines only; the full payload is available via `sourceUrl`.
 */
export const asShortText = (text: any): string | undefined =>
    typeof text === 'string' && text.length > 0 && text.length <= TEXT_LIMIT ? text : undefined;

/**
 * compose plain-text content from a slack message.
 * - joins `.text` and each attachment's `pretext`/`title`/`text`/`fields`.
 * - a long/object `text` is omitted — key lines + `sourceUrl` only.
 */
export const asChaticContent = (body: SlackMessage): string => {
    const lines: string[] = [];
    if (body?.text) lines.push(asShortText(body.text));
    (body?.attachments || []).forEach(({ pretext, title, text, fields }) => {
        if (pretext) lines.push(`${pretext}`);
        if (title) lines.push(`${title}`);
        if (text) lines.push(asShortText(text));
        (fields || []).forEach(field => {
            if (field?.value === undefined || field?.value === null) return;
            lines.push(field.title ? `${field.title}: ${field.value}` : `${field.value}`);
        });
    });
    return lines.filter(N => !!N).join('\n');
};

/**
 * extract structured meta from a slack message.
 * - pretext/title/color/fields/footer come from the first attachment (representative, same convention as `saveMessageToS3()`).
 * - text falls back to `body.text` since a plain message (no attachments) only carries `.text`.
 */
export const asChaticMeta = (body: SlackMessage): Omit<ChaticWebhookMeta, 'sourceUrl'> => {
    const attachment = (body?.attachments || [])[0];
    const fields = (attachment?.fields || [])
        .filter(({ value }) => value !== undefined && value !== null)
        .map(({ title, value }) => onlyDefined({ title: title || undefined, value }));
    return onlyDefined({
        pretext: attachment?.pretext,
        title: attachment?.title,
        text: asShortText(attachment?.text ?? body?.text),
        fields: fields.length > 0 ? fields : undefined,
        color: attachment?.color,
        footer: attachment?.footer,
    });
};

/**
 * build the payload of `chatic` channel from a slack message.
 * - see `POST /hello/chat-send` of `chatic-socials-api`.
 * - the service `token` is carried in the body (not a header), since the receiving handler cannot read custom headers.
 *
 * @param channelId target channel-id in `chatic`.
 * @param body      slack message to convert.
 * @param options.sourceUrl (optional) S3 url of the full original payload, appended to `content` + carried in `meta.sourceUrl`.
 * @param options.token     (optional) service token to authenticate the request. (omitted if not given)
 */
export const asChaticPayload = (
    channelId: string,
    body: SlackMessage,
    options?: { sourceUrl?: string; token?: string },
): { channelId: string; content: string; stereo: string; token?: string; meta?: ChaticWebhookMeta } => {
    const sourceUrl = options?.sourceUrl;
    const content = [asChaticContent(body), sourceUrl].filter(N => !!N).join('\n');
    const meta = onlyDefined({ ...asChaticMeta(body), sourceUrl });
    return onlyDefined({
        channelId,
        content,
        stereo: 'webhook',
        token: options?.token,
        meta: Object.keys(meta || {}).length > 0 ? (meta as ChaticWebhookMeta) : undefined,
    });
};
