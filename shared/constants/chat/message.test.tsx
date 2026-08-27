/// <reference types="jest" />
import * as T from '@/constants/types'
import {
  getMapUnfurl,
  isSpecialMention,
  makeChatPaymentInfo,
  makeMessageSystemText,
  messageAttachmentTransferStateToProgressLabel,
  shouldShowPopup,
  upgradeMessage,
  getMessageID,
  getMessageRenderType,
  getPaymentMessageInfo,
  getReactionOrder,
  isImageViewable,
  isMessageWithReactions,
  isPathHEIC,
  makeMessageAttachment,
  makeMessageDeleted,
  makeMessagePlaceholder,
  makeMessageSendPayment,
  makeMessageText,
  parseUIMessagesJSON,
  reactionMapToReactions,
  rpcErrorToString,
  serviceMessageTypeToMessageTypes,
  systemGitBranchName,
  uiMessageToMessage,
  uiPaymentInfoToChatPaymentInfo,
  uiRequestInfoToChatRequestInfo,
} from './message'

const conversationIDKey = T.Chat.stringToConversationIDKey('conv1')
const getLastOrdinal = () => T.Chat.numberToOrdinal(0)
const username = 'testuser'
const devicename = 'testuser-mac'

const noReactions: T.RPCChat.UIReactionMap = {reactions: undefined}

const makeTextBody = (body: string): T.RPCChat.MessageBody => ({
  messageType: T.RPCChat.MessageType.text,
  text: {body},
})

const makeValid = (overrides: Partial<T.RPCChat.UIMessageValid> = {}): T.RPCChat.UIMessageValid => ({
  botUsername: '',
  bodySummary: 'summary',
  channelMention: T.RPCChat.ChannelMention.none,
  ctime: 1000,
  etime: 0,
  explodedBy: '',
  hasPairwiseMacs: false,
  isCollapsed: false,
  isDeleteable: true,
  isEditable: true,
  isEphemeral: false,
  isEphemeralExpired: false,
  messageBody: makeTextBody('hello'),
  messageID: 5,
  reactions: noReactions,
  senderDeviceID: 'devID' as unknown as T.RPCGen.Gregor1.DeviceID,
  senderDeviceName: devicename,
  senderDeviceType: 'desktop',
  senderUID: 'uid' as unknown as T.RPCGen.Gregor1.UID,
  senderUsername: username,
  superseded: false,
  ...overrides,
})

const validMessage = (overrides: Partial<T.RPCChat.UIMessageValid> = {}): T.RPCChat.UIMessage => ({
  state: T.RPCChat.MessageUnboxedState.valid,
  valid: makeValid(overrides),
})

describe('image/render type helpers', () => {
  test('isPathHEIC is case insensitive', () => {
    expect(isPathHEIC('/tmp/a.HEIC')).toBe(true)
    expect(isPathHEIC('/tmp/a.heic')).toBe(true)
    expect(isPathHEIC('/tmp/a.png')).toBe(false)
  })

  test('isImageViewable only for image attachments (heic is ios only)', () => {
    expect(isImageViewable(makeMessageAttachment({attachmentType: 'image'}))).toBe(true)
    // desktop test env: isIOS is false so heic files are not viewable
    expect(isImageViewable(makeMessageAttachment({attachmentType: 'file', fileName: 'a.heic'}))).toBe(false)
    expect(isImageViewable(makeMessageText())).toBe(false)
  })

  test('getMessageRenderType maps attachments by kind', () => {
    expect(getMessageRenderType(makeMessageText())).toBe('text')
    expect(getMessageRenderType(makeMessageAttachment({attachmentType: 'image'}))).toBe('attachment:image')
    expect(getMessageRenderType(makeMessageAttachment({attachmentType: 'file'}))).toBe('attachment:file')
    expect(
      getMessageRenderType(makeMessageAttachment({attachmentType: 'file', inlineVideoPlayable: true}))
    ).toBe('attachment:video')
    // audio never becomes video even when marked inline playable
    expect(
      getMessageRenderType(makeMessageAttachment({attachmentType: 'audio', inlineVideoPlayable: true}))
    ).toBe('attachment:audio')
  })
})

describe('reactions', () => {
  test('isMessageWithReactions excludes non-reactable, exploded and errored messages', () => {
    expect(isMessageWithReactions(makeMessageText())).toBe(true)
    expect(isMessageWithReactions(makeMessagePlaceholder())).toBe(false)
    expect(isMessageWithReactions(makeMessageDeleted())).toBe(false)
    expect(isMessageWithReactions(makeMessageText({exploded: true}))).toBe(false)
    expect(isMessageWithReactions(makeMessageText({errorReason: 'nope'}))).toBe(false)
  })

  test('getReactionOrder sorts by earliest reaction timestamp', () => {
    const reactions = new Map<string, T.Chat.ReactionDesc>([
      [':wave:', {decorated: '', users: [{timestamp: 30, username: 'a'}]}],
      [':+1:', {decorated: '', users: [{timestamp: 50, username: 'b'}, {timestamp: 10, username: 'c'}]}],
      [':tada:', {decorated: '', users: [{timestamp: 20, username: 'd'}]}],
    ])
    expect(getReactionOrder(reactions)).toEqual([':+1:', ':tada:', ':wave:'])
  })

  test('reactionMapToReactions returns undefined when empty', () => {
    expect(reactionMapToReactions({reactions: undefined})).toBeUndefined()
    expect(reactionMapToReactions({reactions: {}})).toBeUndefined()
  })

  test('reactionMapToReactions maps users and ctimes', () => {
    const res = reactionMapToReactions({
      reactions: {
        ':+1:': {
          decorated: 'decorated',
          users: {
            testuser: {ctime: 7} as T.RPCChat.Reaction,
          },
        },
      },
    })
    expect(res?.get(':+1:')).toEqual({decorated: 'decorated', users: [{timestamp: 7, username: 'testuser'}]})
  })
})

describe('getMessageID', () => {
  test('reads the id out of every state that has one', () => {
    expect(getMessageID(validMessage({messageID: 9}))).toBe(9)
    expect(
      getMessageID({
        error: {messageID: 11} as T.RPCChat.MessageUnboxedError,
        state: T.RPCChat.MessageUnboxedState.error,
      })
    ).toBe(11)
    expect(
      getMessageID({
        placeholder: {hidden: false, messageID: 12},
        state: T.RPCChat.MessageUnboxedState.placeholder,
      })
    ).toBe(12)
    expect(
      getMessageID({
        outbox: {} as T.RPCChat.UIMessageOutbox,
        state: T.RPCChat.MessageUnboxedState.outbox,
      })
    ).toBeNull()
  })
})

describe('serviceMessageTypeToMessageTypes', () => {
  test('maps service types to our types', () => {
    expect(serviceMessageTypeToMessageTypes(T.RPCChat.MessageType.text)).toEqual(['text'])
    expect(serviceMessageTypeToMessageTypes(T.RPCChat.MessageType.attachment)).toEqual(['attachment'])
    expect(serviceMessageTypeToMessageTypes(T.RPCChat.MessageType.attachmentuploaded)).toEqual(['attachment'])
    expect(serviceMessageTypeToMessageTypes(T.RPCChat.MessageType.metadata)).toEqual(['setDescription'])
    expect(serviceMessageTypeToMessageTypes(T.RPCChat.MessageType.headline)).toEqual(['setChannelname'])
    expect(serviceMessageTypeToMessageTypes(T.RPCChat.MessageType.join)).toEqual(['systemJoined'])
  })
})

describe('payments', () => {
  const paymentInfo = (
    overrides: Partial<T.RPCChat.UIPaymentInfo> = {}
  ): T.RPCChat.UIPaymentInfo => ({
    accountID: 'acctID',
    amountDescription: '1 XLM',
    delta: T.RPCStellar.BalanceDelta.increase,
    fromUsername: 'testuser',
    issuerDescription: '',
    note: 'a note',
    paymentID: 'payID',
    showCancel: false,
    sourceAmount: '',
    sourceAsset: {code: '', issuer: '', issuerName: '', type: 'native', verifiedDomain: ''} as T.RPCStellar.Asset,
    status: T.RPCStellar.PaymentStatus.completed,
    statusDescription: 'completed',
    statusDetail: '',
    toUsername: 'testuser-two',
    worth: '$1',
    worthAtSendTime: '$1',
    ...overrides,
  })

  test('uiPaymentInfoToChatPaymentInfo requires exactly one payment', () => {
    expect(uiPaymentInfoToChatPaymentInfo(undefined)).toBeUndefined()
    expect(uiPaymentInfoToChatPaymentInfo([])).toBeUndefined()
    expect(uiPaymentInfoToChatPaymentInfo([paymentInfo(), paymentInfo()])).toBeUndefined()
  })

  test('uiPaymentInfoToChatPaymentInfo stringifies status and delta', () => {
    const res = uiPaymentInfoToChatPaymentInfo([paymentInfo()])
    expect(res?.status).toBe('completed')
    expect(res?.delta).toBe('increase')
    expect(res?.accountID).toBe('acctID')
    expect(res?.note.stringValue()).toBe('a note')
    expect(res?.type).toBe('paymentInfo')
  })

  test('getPaymentMessageInfo prefers the accounts map, falls back to the message', () => {
    const message = makeMessageSendPayment({
      id: T.Chat.numberToMessageID(3),
      paymentInfo: undefined,
    })
    expect(getPaymentMessageInfo(new Map(), message)).toBeUndefined()

    const info = uiPaymentInfoToChatPaymentInfo([paymentInfo()])!
    expect(getPaymentMessageInfo(new Map([[T.Chat.numberToMessageID(3), info]]), message)).toBe(info)
  })

  test('getPaymentMessageInfo throws when the map holds a request info', () => {
    const message = makeMessageSendPayment({id: T.Chat.numberToMessageID(3)})
    const requestInfo = uiRequestInfoToChatRequestInfo({
      amount: '1',
      amountDescription: '1 XLM',
      currency: 'USD',
      status: T.RPCStellar.RequestStatus.ok,
      worthAtRequestTime: '$1',
    })!
    expect(() =>
      getPaymentMessageInfo(new Map([[T.Chat.numberToMessageID(3), requestInfo]]), message)
    ).toThrow()
  })
})

describe('uiRequestInfoToChatRequestInfo', () => {
  const base = {
    amount: '1',
    amountDescription: '1 XLM',
    status: T.RPCStellar.RequestStatus.ok,
    worthAtRequestTime: '$1',
  }

  test('undefined in, undefined out', () => {
    expect(uiRequestInfoToChatRequestInfo(undefined)).toBeUndefined()
  })

  test('requires an asset or a currency', () => {
    expect(uiRequestInfoToChatRequestInfo({...base})).toBeUndefined()
  })

  test('currency requests become currency assets', () => {
    const res = uiRequestInfoToChatRequestInfo({
      ...base,
      currency: 'USD',
    })
    expect(res?.asset).toBe('currency')
    expect(res?.currencyCode).toBe('USD')
    expect(res?.canceled).toBe(false)
    expect(res?.done).toBe(false)
  })

  test('native assets stay native and status flags are derived', () => {
    const canceled = uiRequestInfoToChatRequestInfo({
      ...base,
      asset: {code: '', issuer: '', type: 'native'} as T.RPCStellar.Asset,
      status: T.RPCStellar.RequestStatus.canceled,
    })
    expect(canceled?.asset).toBe('native')
    expect(canceled?.canceled).toBe(true)

    const done = uiRequestInfoToChatRequestInfo({
      ...base,
      asset: {code: '', issuer: '', type: 'native'} as T.RPCStellar.Asset,
      status: T.RPCStellar.RequestStatus.done,
    })
    expect(done?.done).toBe(true)
  })

  test('non-native assets become asset descriptions', () => {
    const res = uiRequestInfoToChatRequestInfo({
      ...base,
      asset: {
        code: 'KEYZ',
        issuer: 'issuerAccountID',
        issuerName: 'Keyz Inc',
        type: 'credit_alphanum4',
        verifiedDomain: 'keyz.example',
      } as T.RPCStellar.Asset,
    })
    expect(res?.asset).toEqual(
      expect.objectContaining({
        code: 'KEYZ',
        issuerAccountID: 'issuerAccountID',
        issuerName: 'Keyz Inc',
        issuerVerifiedDomain: 'keyz.example',
      })
    )
  })
})

describe('rpcErrorToString', () => {
  const err = (typ: T.RPCChat.OutboxErrorType, message = '') =>
    ({message, typ}) as T.RPCChat.OutboxStateError

  test('known types get friendly strings', () => {
    expect(rpcErrorToString(err(T.RPCChat.OutboxErrorType.offline))).toBe('disconnected from chat server')
    expect(rpcErrorToString(err(T.RPCChat.OutboxErrorType.identify))).toBe('proofs failed for recipient user')
    expect(rpcErrorToString(err(T.RPCChat.OutboxErrorType.toolong))).toBe('message is too long')
    expect(rpcErrorToString(err(T.RPCChat.OutboxErrorType.duplicate))).toBe('message already sent')
    expect(rpcErrorToString(err(T.RPCChat.OutboxErrorType.expired))).toBe('took too long to send')
    expect(rpcErrorToString(err(T.RPCChat.OutboxErrorType.restrictedbot))).toBe(
      'bot is restricted from sending to this conversation'
    )
    expect(rpcErrorToString(err(T.RPCChat.OutboxErrorType.minwriter))).toBe(
      'not high enough team role to post in this conversation'
    )
  })

  test('misc uses the message and falls back', () => {
    expect(rpcErrorToString(err(T.RPCChat.OutboxErrorType.misc, 'boom'))).toBe('boom')
    expect(rpcErrorToString(err(T.RPCChat.OutboxErrorType.misc))).toBe('unknown error')
  })

  test('unknown types include the code', () => {
    expect(rpcErrorToString(err(999 as T.RPCChat.OutboxErrorType, 'weird'))).toBe('weird (code: 999)')
  })
})

describe('systemGitBranchName', () => {
  test('strips the refs/heads prefix only', () => {
    expect(systemGitBranchName({refName: 'refs/heads/main'} as T.RPCGen.GitRefMetadata)).toBe('main')
    expect(systemGitBranchName({refName: 'refs/tags/v1'} as T.RPCGen.GitRefMetadata)).toBe('refs/tags/v1')
  })
})

describe('getMapUnfurl', () => {
  const mapInfo = {
    coord: {accuracy: 0, lat: 1, lon: 2},
    isLiveLocationDone: false,
    time: 0,
  } as T.RPCChat.UnfurlGenericMapInfo

  const unfurl = (generic: Partial<T.RPCChat.UnfurlGenericDisplay>): T.RPCChat.UIMessageUnfurlInfo =>
    ({
      unfurl: {
        generic: {siteName: 'maps', title: '', url: 'u', ...generic},
        unfurlType: T.RPCChat.UnfurlType.generic,
      },
      url: 'u',
    }) as T.RPCChat.UIMessageUnfurlInfo

  test('undefined when there are no unfurls', () => {
    expect(getMapUnfurl(makeMessageText())).toBeUndefined()
    expect(getMapUnfurl(makeMessageAttachment())).toBeUndefined()
  })

  test('undefined when the unfurl has no map info', () => {
    const message = makeMessageText({unfurls: new Map([['u', unfurl({})]])})
    expect(getMapUnfurl(message)).toBeUndefined()
  })

  test('returns the generic display for map unfurls', () => {
    const message = makeMessageText({unfurls: new Map([['u', unfurl({mapInfo})]])})
    expect(getMapUnfurl(message)?.mapInfo).toBe(mapInfo)
  })
})

describe('uiMessageToMessage', () => {
  const convert = (m: T.RPCChat.UIMessage) =>
    uiMessageToMessage(conversationIDKey, m, username, getLastOrdinal, devicename)

  test('valid text messages carry text, author and ordinal from the message id', () => {
    const message = convert(validMessage({decoratedTextBody: 'hello *world*'}))
    expect(message?.type).toBe('text')
    if (message?.type !== 'text') throw new Error('expected text')
    expect(message.text.stringValue()).toBe('hello')
    expect(message.decoratedText?.stringValue()).toBe('hello *world*')
    expect(message.author).toBe(username)
    expect(message.id).toBe(5)
    expect(message.ordinal).toBe(5)
    expect(message.timestamp).toBe(1000)
    expect(message.conversationIDKey).toBe(conversationIDKey)
  })

  test('flip messages become text', () => {
    const message = convert(
      validMessage({
        messageBody: {
          flip: {
            flipConvID: new Uint8Array(),
            gameID: 'g' as unknown as T.RPCChat.FlipGameID,
            text: '/flip',
          },
          messageType: T.RPCChat.MessageType.flip,
        } as T.RPCChat.MessageBody,
      })
    )
    if (message?.type !== 'text') throw new Error('expected text')
    expect(message.text.stringValue()).toBe('/flip')
  })

  test('replyTo is converted recursively', () => {
    const message = convert(
      validMessage({
        messageBody: makeTextBody('the reply'),
        messageID: 6,
        replyTo: validMessage({messageBody: makeTextBody('the original')}),
      })
    )
    if (message?.type !== 'text') throw new Error('expected text')
    expect(message.replyTo?.id).toBe(5)
    if (message.replyTo?.type !== 'text') throw new Error('expected text reply')
    expect(message.replyTo.text?.stringValue()).toBe('the original')
  })

  test('expired ephemerals become empty text', () => {
    const message = convert(
      validMessage({
        explodedBy: 'testuser-two',
        isEphemeral: true,
        isEphemeralExpired: true,
      })
    )
    if (message?.type !== 'text') throw new Error('expected text')
    expect(message.text.stringValue()).toBe('')
    expect(message.exploded).toBe(true)
    expect(message.explodedBy).toBe('testuser-two')
    expect(message.exploding).toBe(true)
  })

  test('inline payment success is derived from the payment status descriptions', () => {
    const withStatus = (statusDescription: string) =>
      convert(
        validMessage({
          paymentInfos: [{statusDescription} as T.RPCChat.UIPaymentInfo],
        })
      )
    const completed = withStatus('completed')
    const pending = withStatus('pending')
    if (completed?.type !== 'text' || pending?.type !== 'text') throw new Error('expected text')
    expect(completed.inlinePaymentSuccessful).toBe(true)
    expect(pending.inlinePaymentSuccessful).toBe(false)
  })

  test('edit/delete/deletehistory collapse to deleted', () => {
    for (const messageType of [
      T.RPCChat.MessageType.edit,
      T.RPCChat.MessageType.delete,
      T.RPCChat.MessageType.deletehistory,
    ]) {
      const message = convert(validMessage({messageBody: {messageType} as T.RPCChat.MessageBody}))
      expect(message?.type).toBe('deleted')
    }
  })

  test('headline and metadata become setDescription/setChannelname', () => {
    const headline = convert(
      validMessage({
        messageBody: {
          headline: {headline: 'the topic'},
          messageType: T.RPCChat.MessageType.headline,
        } as T.RPCChat.MessageBody,
      })
    )
    if (headline?.type !== 'setDescription') throw new Error('expected setDescription')
    expect(headline.newDescription.stringValue()).toBe('the topic')

    const metadata = convert(
      validMessage({
        messageBody: {
          messageType: T.RPCChat.MessageType.metadata,
          metadata: {conversationTitle: 'general'},
        } as T.RPCChat.MessageBody,
      })
    )
    if (metadata?.type !== 'setChannelname') throw new Error('expected setChannelname')
    expect(metadata.newChannelname).toBe('general')
  })

  test('pin falls back to its own message id', () => {
    const withPinned = convert(
      validMessage({
        messageBody: {messageType: T.RPCChat.MessageType.pin, pin: {}} as T.RPCChat.MessageBody,
        pinnedMessageID: 3,
      })
    )
    if (withPinned?.type !== 'pin') throw new Error('expected pin')
    expect(withPinned.pinnedMessageID).toBe(3)

    const withoutPinned = convert(
      validMessage({
        messageBody: {messageType: T.RPCChat.MessageType.pin, pin: {}} as T.RPCChat.MessageBody,
      })
    )
    if (withoutPinned?.type !== 'pin') throw new Error('expected pin')
    expect(withoutPinned.pinnedMessageID).toBe(5)
  })

  test('join carries joiners and leavers', () => {
    const message = convert(
      validMessage({
        messageBody: {
          join: {joiners: ['a'], leavers: ['b']},
          messageType: T.RPCChat.MessageType.join,
        } as T.RPCChat.MessageBody,
      })
    )
    if (message?.type !== 'systemJoined') throw new Error('expected systemJoined')
    expect(message.joiners).toEqual(['a'])
    expect(message.leavers).toEqual(['b'])
  })

  test('unsupported bodies convert to nothing', () => {
    expect(
      convert(validMessage({messageBody: {messageType: T.RPCChat.MessageType.none} as T.RPCChat.MessageBody}))
    ).toBeUndefined()
  })

  test('placeholders become placeholder or deleted when hidden', () => {
    const shown = convert({
      placeholder: {hidden: false, messageID: 4},
      state: T.RPCChat.MessageUnboxedState.placeholder,
    })
    expect(shown?.type).toBe('placeholder')
    expect(shown?.ordinal).toBe(4)

    const hidden = convert({
      placeholder: {hidden: true, messageID: 4},
      state: T.RPCChat.MessageUnboxedState.placeholder,
    })
    expect(hidden?.type).toBe('deleted')
  })

  test('errors become text with an errorReason', () => {
    const message = convert({
      error: {
        botUsername: '',
        ctime: 10,
        errMsg: 'could not decrypt',
        errType: T.RPCChat.MessageUnboxedErrorType.misc,
        etime: 0,
        explodedBy: '',
        isEphemeral: false,
        messageID: 7,
        senderDeviceName: devicename,
        senderDeviceType: 'desktop',
        senderUsername: username,
      } as T.RPCChat.MessageUnboxedError,
      state: T.RPCChat.MessageUnboxedState.error,
    })
    if (message?.type !== 'text') throw new Error('expected text')
    expect(message.errorReason).toBe('could not decrypt')
    expect(message.id).toBe(7)
    expect(message.explodingUnreadable).toBe(false)
  })

  test('journeycards are only supported for welcome and popularChannels', () => {
    const welcome = convert({
      journeycard: {
        cardType: T.RPCChat.JourneycardType.welcome,
        highlightMsgID: 2,
        openTeam: true,
        ordinal: 1,
      },
      state: T.RPCChat.MessageUnboxedState.journeycard,
    })
    expect(welcome?.type).toBe('journeycard')

    const unsupported = convert({
      journeycard: {
        cardType: T.RPCChat.JourneycardType.addPeople,
        highlightMsgID: 2,
        openTeam: false,
        ordinal: 1,
      },
      state: T.RPCChat.MessageUnboxedState.journeycard,
    })
    expect(unsupported).toBeUndefined()
  })
})

describe('parseUIMessagesJSON', () => {
  const parse = (json: string, onMessage?: (m: T.Chat.Message) => void) =>
    parseUIMessagesJSON(conversationIDKey, json, username, devicename, getLastOrdinal, onMessage)

  test('bad json yields no messages instead of throwing', () => {
    expect(parse('not json')).toEqual({messages: []})
  })

  test('empty payloads yield no messages', () => {
    expect(parse(JSON.stringify({}))).toEqual({messages: [], pagination: undefined})
  })

  test('converts messages, keeps pagination and skips unconvertible ones', () => {
    const pagination = {last: false, next: 'n', num: 10, previous: 'p'}
    const seen: Array<T.Chat.Message> = []
    const res = parse(
      JSON.stringify({
        messages: [
          validMessage({messageBody: makeTextBody('one'), messageID: 1}),
          validMessage({
            messageBody: {messageType: T.RPCChat.MessageType.none},
            messageID: 2,
          }),
          validMessage({messageBody: makeTextBody('three'), messageID: 3}),
        ],
        pagination,
      }),
      m => seen.push(m)
    )
    expect(res.messages.map(m => m.id)).toEqual([1, 3])
    expect(res.pagination).toEqual(pagination)
    // onMessage runs per converted message, in order, before the next conversion
    expect(seen.map(m => m.id)).toEqual([1, 3])
  })
})

describe('upgradeMessage', () => {
  const pendingText = () =>
    makeMessageText({
      conversationIDKey,
      id: T.Chat.numberToMessageID(0),
      ordinal: T.Chat.numberToOrdinal(10.001),
      submitState: 'pending',
    })

  const sentText = () =>
    makeMessageText({
      conversationIDKey,
      id: T.Chat.numberToMessageID(300),
      ordinal: T.Chat.numberToOrdinal(300),
    })

  test('the sent message keeps the ordinal the pending row already had', () => {
    const upgraded = upgradeMessage(pendingText(), sentText())
    expect(upgraded.ordinal).toBe(10.001)
    expect(upgraded.id).toBe(300)
  })

  test('a late pending copy never replaces the sent message', () => {
    const sent = sentText()
    expect(upgradeMessage(sent, pendingText())).toBe(sent)
  })

  test('an uploaded attachment keeps the pending preview so the row does not flash gray', () => {
    const pending = makeMessageAttachment({
      conversationIDKey,
      ordinal: T.Chat.numberToOrdinal(10.001),
      previewURL: 'file://local-preview',
      submitState: 'pending',
    })
    const sent = makeMessageAttachment({
      conversationIDKey,
      id: T.Chat.numberToMessageID(300),
      ordinal: T.Chat.numberToOrdinal(300),
      previewURL: '',
    })
    const upgraded = upgradeMessage(pending, sent) as T.Chat.MessageAttachment
    expect(upgraded.ordinal).toBe(10.001)
    expect(upgraded.previewURL).toBe('file://local-preview')
  })

  test('an attachment-uploaded update keeps the old id and transfer state', () => {
    const old = makeMessageAttachment({
      conversationIDKey,
      downloadPath: '/tmp/a.png',
      id: T.Chat.numberToMessageID(300),
      ordinal: T.Chat.numberToOrdinal(300),
      previewURL: 'file://local-preview',
      transferProgress: 0.5,
      transferState: 'downloading',
    })
    const uploaded = makeMessageAttachment({
      conversationIDKey,
      id: T.Chat.numberToMessageID(301),
      ordinal: T.Chat.numberToOrdinal(301),
    })
    const upgraded = upgradeMessage(old, uploaded) as T.Chat.MessageAttachment
    // the service deletes by the original id
    expect(upgraded.id).toBe(300)
    expect(upgraded.ordinal).toBe(300)
    expect(upgraded.downloadPath).toBe('/tmp/a.png')
    expect(upgraded.previewURL).toBe('file://local-preview')
    expect(upgraded.transferProgress).toBe(0.5)
    expect(upgraded.transferState).toBe('downloading')
  })

  test('a remote upload in flight is not reported as a local transfer after the upgrade', () => {
    const old = makeMessageAttachment({
      conversationIDKey,
      id: T.Chat.numberToMessageID(300),
      ordinal: T.Chat.numberToOrdinal(300),
      transferState: 'remoteUploading',
    })
    const uploaded = makeMessageAttachment({conversationIDKey, id: T.Chat.numberToMessageID(301)})
    expect((upgradeMessage(old, uploaded) as T.Chat.MessageAttachment).transferState).toBeUndefined()
  })

  test('a real message is never downgraded to a placeholder', () => {
    const real = sentText()
    const placeholder = makeMessagePlaceholder({conversationIDKey, id: T.Chat.numberToMessageID(300)})
    expect(upgradeMessage(real, placeholder)).toBe(real)
    // but a placeholder can be replaced by anything
    expect(upgradeMessage(placeholder, real)).toBe(real)
  })

  test('mismatched types take the new message as-is', () => {
    const text = sentText()
    const attachment = makeMessageAttachment({conversationIDKey, ordinal: T.Chat.numberToOrdinal(400)})
    expect(upgradeMessage(text, attachment)).toBe(attachment)
  })
})

describe('shouldShowPopup', () => {
  test('there is no menu without a message', () => {
    expect(shouldShowPopup(undefined, undefined)).toBe(false)
  })

  test('normal messages get a menu', () => {
    expect(shouldShowPopup(undefined, makeMessageText({conversationIDKey}))).toBe(true)
    expect(shouldShowPopup(undefined, makeMessageAttachment({conversationIDKey}))).toBe(true)
    expect(shouldShowPopup(undefined, makeMessageSystemText({conversationIDKey}))).toBe(true)
  })

  test('bookkeeping messages do not', () => {
    expect(shouldShowPopup(undefined, makeMessageDeleted({conversationIDKey}))).toBe(false)
    expect(shouldShowPopup(undefined, makeMessagePlaceholder({conversationIDKey}))).toBe(false)
  })

  test('renaming to general is suppressed, other renames are not', () => {
    const rename = (newChannelname: string) =>
      ({newChannelname, type: 'setChannelname'}) as T.Chat.MessageSetChannelname
    expect(shouldShowPopup(undefined, rename('random'))).toBe(true)
    expect(shouldShowPopup(undefined, rename('general'))).toBe(false)
  })

  describe('payments', () => {
    const payment = (status: T.Chat.ChatPaymentInfo['status']) =>
      makeChatPaymentInfo({status})
    const message = makeMessageSendPayment({conversationIDKey, id: T.Chat.numberToMessageID(3)})
    const mapWith = (status: T.Chat.ChatPaymentInfo['status']) =>
      new Map([[T.Chat.numberToMessageID(3), payment(status)]])

    test('completed payments get a menu', () => {
      expect(shouldShowPopup(mapWith('completed'), message)).toBe(true)
    })

    test('unsettled payments do not', () => {
      expect(shouldShowPopup(mapWith('claimable'), message)).toBe(false)
      expect(shouldShowPopup(mapWith('pending'), message)).toBe(false)
      expect(shouldShowPopup(mapWith('canceled'), message)).toBe(false)
    })

    test('a payment we know nothing about does not', () => {
      expect(shouldShowPopup(undefined, message)).toBe(false)
      expect(shouldShowPopup(new Map(), message)).toBe(false)
    })
  })
})

test('isSpecialMention knows the broadcast mentions', () => {
  expect(isSpecialMention('here')).toBe(true)
  expect(isSpecialMention('channel')).toBe(true)
  expect(isSpecialMention('everyone')).toBe(true)
  expect(isSpecialMention('testuser')).toBe(false)
  expect(isSpecialMention('')).toBe(false)
})

test('messageAttachmentTransferStateToProgressLabel labels only in-flight transfers', () => {
  expect(messageAttachmentTransferStateToProgressLabel('downloading')).toBe('Downloading')
  expect(messageAttachmentTransferStateToProgressLabel('uploading')).toBe('Uploading')
  expect(messageAttachmentTransferStateToProgressLabel('mobileSaving')).toBe('Saving...')
  expect(messageAttachmentTransferStateToProgressLabel('remoteUploading')).toBe('waiting...')
  expect(messageAttachmentTransferStateToProgressLabel(undefined)).toBe('')
})
