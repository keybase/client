// Chat thread content the account's sealed conversations don't hold: messages the gate can't make
// through the CLI (exploding, audio, payments, a map unfurl, coin flips in each phase, a system
// add, a journey card, custom emoji and mention decorations, a bot's and a revoked device's
// messages), plus what the service only pushes (an unfurl prompt, coin flip statuses, the unread
// line; not typing, whose indicator animates without end). The open conversation's thread replies
// get these messages added after its real ones, sent by the account (they copy the sender fields of
// its oldest message in the thread). Media in them is the thread's oldest image, so the entry opens
// e2e-media.
//
// Message IDs are a reserved synthetic range (SYNTHETIC_FIRST and up, far past any real message of
// the sealed threads); times are offsets from the frozen clock. Marking the conversation read would
// send a synthetic ID to the service, so it is answered here.
import type * as T from '@/constants/types'
import {stub, type FixtureContext, type FixtureDef} from './def.ts'

export const SYNTHETIC_FIRST = 900_001
const id = (i: number) => SYNTHETIC_FIRST + i

type UIMessage = T.RPCChat.UIMessage
type Valid = T.RPCChat.UIMessageValid
type ThreadJSON = {messages?: Array<UIMessage> | null; pagination?: unknown}

const minute = 60 * 1000
const hour = 60 * minute

const str = (ctx: FixtureContext, key: string) => {
  const v = ctx.args[key]
  if (typeof v !== 'string' || !v) throw new Error(`fixture chat-thread-content needs the arg ${key}`)
  return v
}

// Service text decorations, as decoratedTextBody carries them: base64 of the decoration's JSON
// between markers. Every decoration here is ASCII.
const decorate = (d: T.RPCChat.UITextDecoration) => `$>kb$${btoa(JSON.stringify(d))}$<kb$`

const hexToBytes = (hex: string) => new Uint8Array((hex.match(/../g) ?? []).map(h => parseInt(h, 16)))

type Asset = T.RPCChat.Asset
type Media = {valid: Valid; asset: Asset}

// Edit and delete as the service allows them per message type (go/chat/utils
// IsEditableByEditMessageType, IsDeleteableByDeleteMessageType; the only system message here, an
// add to the team, is deletable).
const editable = new Set<T.RPCChat.MessageType>([1, 2])
const deleteable = new Set<T.RPCChat.MessageType>([1, 2, 11, 17])

const payment = (ctx: FixtureContext, paymentID: string): T.RPCChat.UIPaymentInfo => ({
  accountID: null,
  amountDescription: '1 XLM',
  delta: 2, // decrease: the account sent it
  fromUsername: str(ctx, 'username'),
  issuerDescription: 'Stellar Lumens',
  note: 'For the visual gate',
  paymentID,
  showCancel: false,
  sourceAmount: '',
  sourceAsset: {
    authEndpoint: '',
    code: '',
    depositButtonText: '',
    depositReqAuth: false,
    desc: '',
    infoUrl: '',
    infoUrlText: '',
    issuer: '',
    issuerName: '',
    showDepositButton: false,
    showWithdrawButton: false,
    transferServer: '',
    type: 'native',
    useSep24: false,
    verifiedDomain: '',
    withdrawButtonText: '',
    withdrawReqAuth: false,
    withdrawType: '',
  },
  status: 3, // completed
  statusDescription: 'completed',
  statusDetail: '',
  toUsername: str(ctx, 'secondUser'),
  worth: '$0.10',
  worthAtSendTime: '$0.10',
})

// The thread's messages after the real ones, oldest first. `base` is the account's oldest message
// in the thread, whose sender fields the synthetic ones copy; `media` the thread's oldest image.
const synthetic = (ctx: FixtureContext, base: Valid, media: Media): Array<UIMessage> => {
  const me = str(ctx, 'username')
  const second = str(ctx, 'secondUser')
  const team = str(ctx, 'teamname')
  const bot = str(ctx, 'bot')
  const at = (i: number) => ctx.now - (40 - i) * minute
  const valid = (i: number, v: Partial<Valid> & Pick<Valid, 'messageBody' | 'bodySummary'>): UIMessage => ({
    state: 1,
    valid: {
      ...base,
      assetUrlInfo: null,
      atMentions: null,
      botUsername: '',
      channelMention: 0,
      channelNameMentions: [],
      ctime: at(i),
      decoratedTextBody: null,
      etime: 0,
      explodedBy: null,
      flipGameID: null,
      hasPairwiseMacs: false,
      isCollapsed: false,
      isDeleteable: deleteable.has(v.messageBody.messageType),
      isEditable: editable.has(v.messageBody.messageType),
      isEphemeral: false,
      isEphemeralExpired: false,
      messageID: id(i),
      outboxID: null,
      paymentInfos: null,
      pinnedMessageID: null,
      reactions: {reactions: {}},
      replyTo: null,
      requestInfo: null,
      senderDeviceRevokedAt: null,
      superseded: false,
      unfurls: null,
      ...v,
    },
  })
  const text = (i: number, body: string, v: Partial<Valid> = {}) =>
    valid(i, {
      bodySummary: body,
      decoratedTextBody: body,
      messageBody: {messageType: 1, text: {body, emojis: null, payments: null, teamMentions: null, userMentions: null}},
      ...v,
    })
  const flip = (i: number, gameID: string, body: string) =>
    valid(i, {
      bodySummary: body,
      flipGameID: gameID,
      messageBody: {messageType: 17, flip: {flipConvID: new Uint8Array(), gameID: new Uint8Array(), text: body}},
    })
  const image = media.asset
  const previewURL = media.valid.assetUrlInfo?.previewUrl ?? ''
  const emoji: T.RPCChat.Emoji = {
    alias: 'vg-emoji',
    isAlias: false,
    isBig: false,
    isCrossTeam: false,
    isReacji: false,
    noAnimSource: {httpsrv: previewURL, typ: 0},
    remoteSource: {stockalias: {text: ':vg-emoji:', time: at(0), username: me}, typ: 1},
    source: {httpsrv: previewURL, typ: 0},
    teamname: team,
  }
  const path = `/keybase/private/${me}`
  const paymentText = `+1XLM@${second}`
  return [
    valid(0, {
      bodySummary: '',
      messageBody: {messageType: 11, system: {addedtoteam: {addee: me, adder: second, bulkAdds: null, role: 2, team}, systemType: 0}},
    }),
    {journeycard: {cardType: 1, highlightMsgID: 0, openTeam: false, ordinal: id(1)}, state: 5},
    text(2, 'A message from a bot.', {botUsername: bot, senderUsername: bot}),
    text(3, 'A message from a device that was revoked since.', {senderDeviceRevokedAt: ctx.now - 2 * 24 * hour}),
    text(4, `@${team} @vg-nobody ${path} :vg-emoji:`, {
      decoratedTextBody: [
        decorate({maybemention: {channel: '', name: team}, typ: 3}),
        decorate({maybemention: {channel: '', name: 'vg-nobody'}, typ: 3}),
        decorate({
          kbfspath: {
            pathInfo: {deeplinkPath: `keybase://private/${me}`, platformAfterMountPath: `/private/${me}`, standardPath: path},
            rawPath: path,
            standardPath: path,
            startIndex: 0,
          },
          typ: 6,
        }),
        decorate({emoji, typ: 7}),
      ].join(' '),
    }),
    // also encrypted for the team's bot, which its menu's header names
    text(5, 'This message explodes.', {botUsername: bot, etime: ctx.now + 6 * hour, isEphemeral: true}),
    valid(6, {
      assetUrlInfo: media.valid.assetUrlInfo,
      bodySummary: 'Audio message',
      messageBody: {
        attachment: {
          emojis: null,
          metadata: new Uint8Array(),
          object: {...image, filename: 'vg-audio.m4a', metadata: {assetType: 2, video: {durationMs: 4000, height: 0, isAudio: true, width: 0}}, mimeType: 'audio/mp4', title: ''},
          preview: null,
          previews: [{...image, metadata: {assetType: 1, image: {audioAmps: [0.1, 0.4, 0.8, 0.5, 0.2, 0.6, 0.9, 0.3], height: 0, width: 0}}}],
          teamMentions: null,
          uploaded: true,
          userMentions: null,
        },
        messageType: 2,
      },
    }),
    text(7, 'Where we met', {
      unfurls: [
        {
          isCollapsed: false,
          unfurl: {
            generic: {
              description: null,
              favicon: null,
              mapInfo: {coord: {accuracy: 10, lat: 40.7, lon: -74}, isLiveLocationDone: true, liveLocationEndTime: null, time: at(7)},
              media: {height: 240, isVideo: false, url: previewURL, width: 320},
              publishTime: null,
              siteName: 'Location Share',
              title: 'Location',
              url: 'https://www.google.com/maps/place/40.7,-74',
            },
            unfurlType: 0,
          },
          unfurlMessageID: id(30),
          url: 'https://www.google.com/maps/place/40.7,-74',
        },
      ],
    }),
    text(8, 'A link the service asks about: https://example.com/visual-gate'),
    flip(9, 'vg-flip-hands', '/flip cards 3 ann,ben'),
    flip(10, 'vg-flip-shuffle', '/flip a,b,c,d,e,f,g'),
    flip(11, 'vg-flip-commitment', '/flip'),
    valid(12, {
      bodySummary: '',
      messageBody: {messageType: 14, sendpayment: {paymentID: 'vg-payment-1'}},
      paymentInfos: [payment(ctx, 'vg-payment-1')],
    }),
    text(13, `Paid ${paymentText}`, {
      decoratedTextBody: `Paid ${decorate({payment: {paymentText, result: {resultTyp: 0, sent: 'vg-payment-2'}, username: second}, typ: 0})}`,
      messageBody: {
        messageType: 1,
        text: {
          body: `Paid ${paymentText}`,
          emojis: null,
          payments: [{paymentText, result: {resultTyp: 0, sent: 'vg-payment-2'}, username: second}],
          teamMentions: null,
          userMentions: null,
        },
      },
      paymentInfos: [payment(ctx, 'vg-payment-2')],
    }),
  ]
}

const oldest = <M extends {messageID: number}>(ms: ReadonlyArray<M>) =>
  ms.reduce<M | undefined>((o, m) => (!o || m.messageID < o.messageID ? m : o), undefined)

const imageOf = (valid: Valid): Media | undefined =>
  valid.messageBody.messageType === 2 && valid.assetUrlInfo?.mimeType.startsWith('image/')
    ? {asset: valid.messageBody.attachment.object, valid}
    : undefined

// Throws without a message of the account's or an image in the page: the runtime reports it at end().
const addMessages = (thread: string, ctx: FixtureContext) => {
  const t = JSON.parse(thread) as ThreadJSON
  const messages = t.messages ?? []
  const valids = messages.flatMap(m => (m.state === 1 ? [m.valid] : []))
  const me = str(ctx, 'username')
  const base = oldest(valids.filter(v => v.senderUsername === me))
  if (!base) throw new Error(`no message of ${me} in the thread page, whose sender fields its messages copy`)
  const image = oldest(valids.filter(v => !!imageOf(v)))
  const media = image && imageOf(image)
  if (!media) throw new Error('no image in the thread page, whose media its messages show')
  // the thread's replies are newest first
  return JSON.stringify({...t, messages: [...synthetic(ctx, base, media).reverse(), ...messages]})
}

const rewriteThread = (param: object, ctx: FixtureContext) => {
  const p = param as {thread?: string}
  return p.thread ? {...p, thread: addMessages(p.thread, ctx)} : param
}

const participant = (username: string, reveal: boolean): T.RPCChat.UICoinFlipParticipant => ({
  commitment: 'vg-commitment',
  deviceID: '',
  deviceName: 'visual gate',
  reveal: reveal ? 'vg-reveal' : null,
  uid: '',
  username,
})

const flipStatus = (
  ctx: FixtureContext,
  gameID: string,
  phase: T.RPCChat.UICoinFlipPhase,
  resultInfo: T.RPCChat.UICoinFlipResult | null
): T.RPCChat.UICoinFlipStatus => ({
  commitmentVisualization: '',
  convID: str(ctx, 'conversationIDKey'),
  errorInfo: null,
  gameID,
  participants: [participant(str(ctx, 'username'), phase !== 0), participant(str(ctx, 'secondUser'), phase !== 0)],
  phase,
  progressText: '',
  resultInfo,
  resultText: '',
  revealVisualization: '',
})

export const chatThreadContent: FixtureDef = {
  hold: true,
  incoming: [
    {method: 'chat.1.chatUi.chatThreadCached', transform: rewriteThread},
    {method: 'chat.1.chatUi.chatThreadFull', transform: rewriteThread},
  ],
  // what the service pushes once the thread is in
  follow: [
    {
      after: 'chat.1.chatUi.chatThreadFull',
      method: 'chat.1.chatUi.chatCoinFlipStatus',
      param: ctx => ({
        statuses: [
          flipStatus(ctx, 'vg-flip-hands', 2, {
            hands: [
              {hand: [0, 13, 26], target: 'ann'},
              {hand: [39, 12, 25], target: 'ben'},
            ],
            typ: 3,
          }),
          flipStatus(ctx, 'vg-flip-shuffle', 2, {shuffle: ['g', 'c', 'a', 'f', 'b', 'e', 'd'], typ: 1}),
          flipStatus(ctx, 'vg-flip-commitment', 0, null),
        ],
      }),
    },
    {
      after: 'chat.1.chatUi.chatThreadFull',
      method: 'chat.1.NotifyChat.ChatPromptUnfurl',
      param: ctx => ({convID: hexToBytes(str(ctx, 'conversationIDKey')), domain: 'example.com', msgID: id(8), uid: ''}),
    },
  ],
  rpc: [
    // the unread line sits above the first synthetic message
    stub('chat.1.local.getUnreadline', () => ({offline: false, unreadlineID: id(0)}), {required: false}),
    stub('chat.1.local.markAsReadLocal', () => ({offline: false, rateLimits: null}), {required: false}),
  ],
  teardown: 'reload',
}
