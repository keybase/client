import * as Chat2Gen from '../../actions/chat2-gen'
import * as EngineGen from '../../actions/engine-gen-gen'
import * as Common from './common'
import * as Message from './message'
import * as Meta from './meta'
import * as RPCChatTypes from '../types/rpc-chat-gen'
import * as RPCTypes from '../types/rpc-gen'
import * as React from 'react'
import * as Types from '../types/chat2'
import * as Z from '../../util/zustand'
import * as RouterConstants from '../router2'
import * as TeamsConstants from '../teams'
import {useConfigState, useCurrentUserState} from '../config'
import HiddenString from '../../util/hidden-string'
import isEqual from 'lodash/isEqual'
import logger from '../../logger'
import type * as TeamsTypes from '../types/teams'
import {RPCError} from '../../util/errors'
import {mapGetEnsureValue} from '../../util/map'
import {noConversationIDKey} from '../types/chat2/common'
import {type StoreApi, type UseBoundStore, useStore} from 'zustand'
import {findLast} from '../../util/arrays'
import shallowEqual from 'shallowequal'

const makeThreadSearchInfo = (): Types.ThreadSearchInfo => ({
  hits: [],
  status: 'initial',
  visible: false,
})

const noParticipantInfo: Types.ParticipantInfo = {
  all: [],
  contactName: new Map(),
  name: [],
}

// per convo store
type ConvoStore = {
  id: Types.ConversationIDKey
  // temp cache for requestPayment and sendPayment message data,
  accountsInfoMap: Map<RPCChatTypes.MessageID, Types.ChatRequestInfo | Types.ChatPaymentInfo>
  attachmentViewMap: Map<RPCChatTypes.GalleryItemTyp, Types.AttachmentViewInfo>
  badge: number
  botCommandsUpdateStatus: RPCChatTypes.UIBotCommandsUpdateStatusTyp
  botSettings: Map<string, RPCTypes.TeamBotSettings | undefined>
  botTeamRoleMap: Map<string, TeamsTypes.TeamRoleType | undefined>
  commandMarkdown?: RPCChatTypes.UICommandMarkdown
  commandStatus?: Types.CommandStatusInfo
  containsLatestMessage?: boolean
  dismissedInviteBanners: boolean
  draft?: string
  editing: Types.Ordinal // current message being edited,
  explodingMode: number // seconds to exploding message expiration,
  explodingModeLock?: number // locks set on exploding mode while user is inputting text,
  giphyResult?: RPCChatTypes.GiphySearchResults
  giphyWindow: boolean
  markedAsUnread: boolean // store a bit if we've marked this thread as unread so we don't mark as read when navgiating away
  messageCenterOrdinal?: Types.CenterOrdinal // ordinals to center threads on,
  messageTypeMap: Map<Types.Ordinal, Types.RenderMessageType> // messages types to help the thread, text is never used
  messageOrdinals?: Array<Types.Ordinal> // ordered ordinals in a thread,
  meta: Types.ConversationMeta // metadata about a thread, There is a special node for the pending conversation,
  moreToLoad: boolean
  muted: boolean
  mutualTeams: Array<TeamsTypes.TeamID>
  orangeLine: Types.Ordinal // last message we've seen,
  participants: Types.ParticipantInfo
  pendingOutboxToOrdinal: Map<Types.OutboxID, Types.Ordinal> // messages waiting to be sent,
  replyTo: Types.Ordinal
  threadLoadStatus: RPCChatTypes.UIChatThreadStatusTyp
  threadSearchInfo: Types.ThreadSearchInfo
  threadSearchQuery: string
  typing: Set<string>
  unfurlPrompt: Map<Types.MessageID, Set<string>>
  unread: number
  unsentText?: string
}

const initialConvoStore: ConvoStore = {
  accountsInfoMap: new Map(),
  attachmentViewMap: new Map(),
  badge: 0,
  botCommandsUpdateStatus: RPCChatTypes.UIBotCommandsUpdateStatusTyp.blank,
  botSettings: new Map(),
  botTeamRoleMap: new Map(),
  commandMarkdown: undefined,
  commandStatus: undefined,
  containsLatestMessage: undefined,
  dismissedInviteBanners: false,
  draft: undefined,
  editing: 0,
  explodingMode: 0,
  explodingModeLock: undefined,
  giphyResult: undefined,
  giphyWindow: false,
  id: noConversationIDKey,
  markedAsUnread: false,
  messageCenterOrdinal: undefined,
  messageOrdinals: undefined,
  messageTypeMap: new Map(),
  meta: Meta.makeConversationMeta(),
  moreToLoad: false,
  muted: false,
  mutualTeams: [],
  orangeLine: 0,
  participants: noParticipantInfo,
  pendingOutboxToOrdinal: new Map(),
  replyTo: 0,
  threadLoadStatus: RPCChatTypes.UIChatThreadStatusTyp.none,
  threadSearchInfo: makeThreadSearchInfo(),
  threadSearchQuery: '',
  typing: new Set(),
  unfurlPrompt: new Map(),
  unread: 0,
  unsentText: undefined,
}
export type ConvoState = ConvoStore & {
  dispatch: {
    addBotMember: (
      username: string,
      allowCommands: boolean,
      allowMentions: boolean,
      restricted: boolean,
      convs?: Array<string>
    ) => void
    badgesUpdated: (badge: number) => void
    botCommandsUpdateStatus: (b: RPCChatTypes.UIBotCommandsUpdateStatus) => void
    clearAttachmentView: () => void
    clearMessageTypeMap: () => void
    dismissBottomBanner: () => void
    editBotSettings: (
      username: string,
      allowCommands: boolean,
      allowMentions: boolean,
      convs?: Array<string>
    ) => void
    giphyGotSearchResult: (results: RPCChatTypes.GiphySearchResults) => void
    giphySend: (result: RPCChatTypes.GiphySearchResult) => void
    giphyToggleWindow: (show: boolean) => void
    hideSearch: () => void
    loadAttachmentView: (viewType: RPCChatTypes.GalleryItemTyp, fromMsgID?: Types.MessageID) => void
    loadOrangeLine: () => void
    metaReceivedError: (error: RPCChatTypes.InboxUIItemError, username: string) => void
    mute: (m: boolean) => void
    onEngineIncoming: (action: EngineGen.Chat1ChatUiChatInboxFailedPayload) => void
    paymentInfoReceived: (messageID: RPCChatTypes.MessageID, paymentInfo: Types.ChatPaymentInfo) => void
    refreshBotRoleInConv: (username: string) => void
    refreshBotSettings: (username: string) => void
    refreshMutualTeamsInConv: () => void
    removeBotMember: (username: string) => void
    requestInfoReceived: (messageID: RPCChatTypes.MessageID, requestInfo: Types.ChatRequestInfo) => void
    resetState: 'default'
    resetUnsentText: () => void
    selectedConversation: () => void
    setCommandMarkdown: (md?: RPCChatTypes.UICommandMarkdown) => void
    setCommandStatusInfo: (info?: Types.CommandStatusInfo) => void
    setContainsLatestMessage: (c: boolean) => void
    setDraft: (d?: string) => void
    setEditing: (ordinal: Types.Ordinal | boolean) => void // true is last, false is clear
    setExplodingMode: (seconds: number, incoming?: boolean) => void
    setExplodingModeLocked: (locked: boolean) => void
    // false to clear
    setMarkAsUnread: (readMsgID?: RPCChatTypes.MessageID | false) => void
    setMessageCenterOrdinal: (m?: Types.CenterOrdinal) => void
    setMessageTypeMap: (o: Types.Ordinal, t?: Types.RenderMessageType) => void
    setMessageOrdinals: (os?: Array<Types.Ordinal>) => void
    setMeta: (m?: Types.ConversationMeta) => void
    setMoreToLoad: (m: boolean) => void
    setMuted: (m: boolean) => void
    setOrangeLine: (o: Types.Ordinal) => void
    setParticipants: (p: ConvoState['participants']) => void
    setPendingOutboxToOrdinal: (p: ConvoState['pendingOutboxToOrdinal']) => void
    setReplyTo: (o: Types.Ordinal) => void
    setThreadLoadStatus: (status: RPCChatTypes.UIChatThreadStatusTyp) => void
    setThreadSearchQuery: (query: string) => void
    setTyping: (t: Set<string>) => void
    threadSearch: (query: string) => void
    toggleThreadSearch: (hide?: boolean) => void
    updateMeta: (m: Partial<Types.ConversationMeta>) => void
    unfurlTogglePrompt: (messageID: Types.MessageID, domain: string, show: boolean) => void
    updateAttachmentViewTransfer: (msgId: number, ratio: number) => void
    updateAttachmentViewTransfered: (msgId: number, path: string) => void
    unreadUpdated: (unread: number) => void
    // this is how you set the unset value, including ''
    setUnsentText: (u: string) => void
  }
  getExplodingMode: () => number
  getEditInfo: () => {exploded: boolean; ordinal: Types.Ordinal; text: string} | undefined
}

// don't bug the users with black bars for network errors. chat isn't going to work in general
const ignoreErrors = [
  RPCTypes.StatusCode.scgenericapierror,
  RPCTypes.StatusCode.scapinetworkerror,
  RPCTypes.StatusCode.sctimeout,
]

const makeAttachmentViewInfo = (): Types.AttachmentViewInfo => ({
  last: false,
  messages: [],
  status: 'loading',
})

const createSlice: Z.ImmerStateCreator<ConvoState> = (set, get) => {
  const getReduxState = Z.getReduxStore()
  const reduxDispatch = Z.getReduxDispatch()
  const closeBotModal = () => {
    RouterConstants.useState.getState().dispatch.clearModals()
    const meta = get().meta
    if (meta.teamname) {
      TeamsConstants.useState.getState().dispatch.getMembers(meta.teamID)
    }
  }

  const dispatch: ConvoState['dispatch'] = {
    addBotMember: (username, allowCommands, allowMentions, restricted, convs) => {
      const f = async () => {
        const conversationIDKey = get().id
        try {
          await RPCChatTypes.localAddBotMemberRpcPromise(
            {
              botSettings: restricted ? {cmds: allowCommands, convs, mentions: allowMentions} : null,
              convID: Types.keyToConversationID(conversationIDKey),
              role: restricted ? RPCTypes.TeamRole.restrictedbot : RPCTypes.TeamRole.bot,
              username,
            },
            Common.waitingKeyBotAdd
          )
        } catch (error) {
          if (error instanceof RPCError) {
            logger.info('addBotMember: failed to add bot member: ' + error.message)
          }
          return
        }
        closeBotModal()
      }
      Z.ignorePromise(f())
    },
    badgesUpdated: badge => {
      set(s => {
        s.badge = badge
      })
    },
    botCommandsUpdateStatus: status => {
      set(s => {
        s.botCommandsUpdateStatus = status.typ
        if (status.typ === RPCChatTypes.UIBotCommandsUpdateStatusTyp.uptodate) {
          const settingsMap = new Map<string, RPCTypes.TeamBotSettings | undefined>()
          Object.keys(status.uptodate.settings).forEach(u => {
            settingsMap.set(u, status.uptodate.settings[u])
          })
          s.botSettings = settingsMap
        }
      })
    },
    clearAttachmentView: () => {
      set(s => {
        s.attachmentViewMap = new Map()
      })
    },
    clearMessageTypeMap: () => {
      set(s => {
        s.messageTypeMap.clear()
      })
    },
    dismissBottomBanner: () => {
      set(s => {
        s.dismissedInviteBanners = true
      })
    },
    editBotSettings: (username, allowCommands, allowMentions, convs) => {
      const f = async () => {
        const conversationIDKey = get().id
        try {
          await RPCChatTypes.localSetBotMemberSettingsRpcPromise(
            {
              botSettings: {cmds: allowCommands, convs, mentions: allowMentions},
              convID: Types.keyToConversationID(conversationIDKey),
              username,
            },
            Common.waitingKeyBotAdd
          )
        } catch (error) {
          if (error instanceof RPCError) {
            logger.info('addBotMember: failed to edit bot settings: ' + error.message)
          }
          return
        }
        closeBotModal()
      }
      Z.ignorePromise(f())
    },
    giphyGotSearchResult: results => {
      set(s => {
        s.giphyResult = results
      })
    },
    giphySend: result => {
      set(s => {
        s.giphyWindow = false
      })
      const f = async () => {
        const conversationIDKey = get().id
        const replyTo = Common.getReplyToMessageID(get().replyTo, getReduxState(), conversationIDKey)
        try {
          await RPCChatTypes.localTrackGiphySelectRpcPromise({result})
        } catch {}
        const url = new HiddenString(result.targetUrl)
        getConvoState(conversationIDKey).dispatch.setUnsentText('')
        reduxDispatch(
          Chat2Gen.createMessageSend({conversationIDKey, replyTo: replyTo || undefined, text: url})
        )
      }
      Z.ignorePromise(f())
    },
    giphyToggleWindow: (show: boolean) => {
      set(s => {
        s.giphyWindow = show
      })
    },
    hideSearch: () => {
      set(s => {
        s.threadSearchInfo.visible = false
      })
    },
    loadAttachmentView: (viewType, fromMsgID) => {
      set(s => {
        const {attachmentViewMap} = s
        const info = mapGetEnsureValue(attachmentViewMap, viewType, makeAttachmentViewInfo())
        info.status = 'loading'
      })

      const f = async () => {
        const conversationIDKey = get().id
        const ConfigConstants = await import('../config')
        try {
          const res = await RPCChatTypes.localLoadGalleryRpcListener(
            {
              incomingCallMap: {
                'chat.1.chatUi.chatLoadGalleryHit': (
                  hit: RPCChatTypes.MessageTypes['chat.1.chatUi.chatLoadGalleryHit']['inParam']
                ) => {
                  const getLastOrdinal = () => get().messageOrdinals?.at(-1) ?? 0
                  const username = ConfigConstants.useCurrentUserState.getState().username
                  const devicename = ConfigConstants.useCurrentUserState.getState().deviceName
                  const message = Message.uiMessageToMessage(
                    conversationIDKey,
                    hit.message,
                    username,
                    getLastOrdinal,
                    devicename
                  )

                  if (message) {
                    set(s => {
                      const info = mapGetEnsureValue(s.attachmentViewMap, viewType, makeAttachmentViewInfo())
                      if (!info.messages.find((item: any) => item.id === message.id)) {
                        info.messages = info.messages.concat(message).sort((l, r) => r.id - l.id)
                      }
                      // inject them into the message map
                      // // TODO >>>>>>>>>>>>>>>> when message map is in here can't mutate it here yet
                      // const {messageMap} = getReduxState().chat2
                      // const mm = mapGetEnsureValue(messageMap, conversationIDKey, new Map())
                      // info.messages.forEach(m => {
                      //   mm.set(m.id, m)
                      // })
                    })
                  }
                },
              },
              params: {
                convID: Types.keyToConversationID(conversationIDKey),
                fromMsgID,
                num: 50,
                typ: viewType,
              },
            },
            Z.dummyListenerApi
          )
          set(s => {
            const info = mapGetEnsureValue(s.attachmentViewMap, viewType, makeAttachmentViewInfo())
            info.last = !!res.last
            info.status = 'success'
          })
        } catch (error) {
          if (error instanceof RPCError) {
            logger.error('failed to load attachment view: ' + error.message)
            set(s => {
              const info = mapGetEnsureValue(s.attachmentViewMap, viewType, makeAttachmentViewInfo())
              info.last = false
              info.status = 'error'
            })
          }
        }
      }
      Z.ignorePromise(f())
    },
    loadOrangeLine: () => {
      const f = async () => {
        const Constants = await import('.')
        const conversationIDKey = get().id
        if (!Types.isValidConversationIDKey(conversationIDKey)) {
          logger.info('Load unreadline bail: no conversationIDKey')
          return
        }
        const convID = Types.keyToConversationID(conversationIDKey)
        if (!convID) {
          logger.info('Load unreadline bail: invalid conversationIDKey')
          return
        }
        const {readMsgID} = get().meta
        try {
          const unreadlineRes = await RPCChatTypes.localGetUnreadlineRpcPromise({
            convID,
            identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
            readMsgID: readMsgID < 0 ? 0 : readMsgID,
          })
          const unreadlineID = unreadlineRes.unreadlineID ? unreadlineRes.unreadlineID : 0
          logger.info(`marking unreadline ${conversationIDKey} ${unreadlineID}`)
          Chat2Gen.createUpdateUnreadline({
            conversationIDKey,
            messageID: Types.numberToMessageID(unreadlineID),
          })
          if (get().markedAsUnread) {
            // Remove the force unread bit for the next time we view the thread.
            get().dispatch.setMarkAsUnread(false)
          }
        } catch (error) {
          if (error instanceof RPCError) {
            if (error.code === RPCTypes.StatusCode.scchatnotinteam) {
              const {inboxRefresh} = Constants.useState.getState().dispatch
              inboxRefresh('maybeKickedFromTeam')
              reduxDispatch(Chat2Gen.createNavigateToInbox())
            }
          }
          // ignore this error in general
        }
      }
      Z.ignorePromise(f())
    },
    metaReceivedError: (error, username) => {
      if (error) {
        if (
          error.typ === RPCChatTypes.ConversationErrorType.otherrekeyneeded ||
          error.typ === RPCChatTypes.ConversationErrorType.selfrekeyneeded
        ) {
          const {rekeyInfo} = error
          const participants = [
            ...(rekeyInfo
              ? new Set<string>(
                  ([] as Array<string>)
                    .concat(rekeyInfo.writerNames || [], rekeyInfo.readerNames || [])
                    .filter(Boolean)
                )
              : new Set<string>(error.unverifiedTLFName.split(','))),
          ]

          const rekeyers = new Set<string>(
            error.typ === RPCChatTypes.ConversationErrorType.selfrekeyneeded
              ? [username || '']
              : (rekeyInfo && rekeyInfo.rekeyers) || []
          )
          const newMeta = Meta.unverifiedInboxUIItemToConversationMeta(error.remoteConv)
          if (!newMeta) {
            // public conversation, do nothing
            return
          }
          get().dispatch.setMeta({
            ...newMeta,
            rekeyers,
            snippet: error.message,
            snippetDecoration: RPCChatTypes.SnippetDecoration.none,
            trustedState: 'error' as const,
          })
          get().dispatch.setParticipants({
            all: participants,
            contactName: noParticipantInfo.contactName,
            name: participants,
          })
        } else {
          get().dispatch.updateMeta({
            snippet: error.message,
            snippetDecoration: RPCChatTypes.SnippetDecoration.none,
            trustedState: 'error',
          })
        }
      } else {
        get().dispatch.setMeta()
      }
    },
    mute: m => {
      const f = async () => {
        await RPCChatTypes.localSetConversationStatusLocalRpcPromise({
          conversationID: Types.keyToConversationID(get().id),
          identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
          status: m ? RPCChatTypes.ConversationStatus.muted : RPCChatTypes.ConversationStatus.unfiled,
        })
      }
      Z.ignorePromise(f())
    },
    onEngineIncoming: (action: EngineGen.Chat1ChatUiChatInboxFailedPayload) => {
      switch (action.type) {
        case EngineGen.chat1ChatUiChatInboxFailed: {
          const f = async () => {
            const ConfigConstants = await import('../config')
            const username = ConfigConstants.useCurrentUserState.getState().username
            const {convID, error} = action.payload.params
            const conversationIDKey = Types.conversationIDToKey(convID)
            switch (error.typ) {
              case RPCChatTypes.ConversationErrorType.transient:
                logger.info(
                  `onFailed: ignoring transient error for convID: ${conversationIDKey} error: ${error.message}`
                )
                return
              default:
                logger.info(
                  `onFailed: displaying error for convID: ${conversationIDKey} error: ${error.message}`
                )
                get().dispatch.metaReceivedError(error, username)
            }
          }
          Z.ignorePromise(f())
          break
        }
      }
    },
    paymentInfoReceived: (messageID, paymentInfo) => {
      set(s => {
        s.accountsInfoMap.set(messageID, paymentInfo)
      })
    },
    refreshBotRoleInConv: username => {
      const f = async () => {
        const TeamsConstants = await import('../teams')
        let role: RPCTypes.TeamRole | undefined
        const conversationIDKey = get().id
        try {
          role = await RPCChatTypes.localGetTeamRoleInConversationRpcPromise({
            convID: Types.keyToConversationID(conversationIDKey),
            username,
          })
        } catch (error) {
          if (error instanceof RPCError) {
            logger.info(`refreshBotRoleInConv: failed to refresh bot team role: ${error.message}`)
          }
          return
        }
        const trole = TeamsConstants.teamRoleByEnum[role]
        const r = !trole || trole === 'none' ? undefined : trole
        set(s => {
          const roles = s.botTeamRoleMap
          if (r !== undefined) {
            roles.set(username, r)
          } else {
            roles.delete(username)
          }
        })
      }
      Z.ignorePromise(f())
    },
    refreshBotSettings: username => {
      set(s => {
        s.botSettings.delete(username)
      })
      const conversationIDKey = get().id
      const f = async () => {
        try {
          const settings = await RPCChatTypes.localGetBotMemberSettingsRpcPromise({
            convID: Types.keyToConversationID(conversationIDKey),
            username,
          })
          set(s => {
            s.botSettings.set(username, settings)
          })
        } catch (error) {
          if (error instanceof RPCError) {
            logger.info(`refreshBotSettings: failed to refresh settings for ${username}: ${error.message}`)
          }
          return
        }
      }
      Z.ignorePromise(f())
    },
    refreshMutualTeamsInConv: () => {
      const f = async () => {
        const ConfigConstants = await import('../config')
        const conversationIDKey = get().id
        const username = ConfigConstants.useCurrentUserState.getState().username
        const otherParticipants = Meta.getRowParticipants(get().participants, username || '')
        const results = await RPCChatTypes.localGetMutualTeamsLocalRpcPromise(
          {usernames: otherParticipants},
          Common.waitingKeyMutualTeams(conversationIDKey)
        )
        set(s => {
          s.mutualTeams = results.teamIDs ?? []
        })
      }
      Z.ignorePromise(f())
    },
    removeBotMember: username => {
      const f = async () => {
        const convID = Types.keyToConversationID(get().id)
        try {
          await RPCChatTypes.localRemoveBotMemberRpcPromise({convID, username}, Common.waitingKeyBotRemove)
          closeBotModal()
        } catch (error) {
          if (error instanceof RPCError) {
            logger.info('removeBotMember: failed to remove bot member: ' + error.message)
          }
        }
      }
      Z.ignorePromise(f())
    },
    requestInfoReceived: (messageID, requestInfo) => {
      set(s => {
        s.accountsInfoMap.set(messageID, requestInfo)
      })
    },
    resetState: 'default',
    resetUnsentText: () => {
      set(s => {
        s.unsentText = undefined
      })
    },
    selectedConversation: () => {
      // blank out draft so we don't flash old data when switching convs
      set(s => {
        s.meta.draft = ''
      })

      const f = async () => {
        const Constants = await import('.')
        const ConfigConstants = await import('../config')
        const UsersConstants = await import('../users')
        const conversationIDKey = get().id

        const fetchConversationBio = () => {
          const participantInfo = get().participants
          const username = ConfigConstants.useCurrentUserState.getState().username
          const otherParticipants = Constants.getRowParticipants(participantInfo, username || '')
          if (otherParticipants.length === 1) {
            // we're in a one-on-one convo
            const username = otherParticipants[0] || ''

            // if this is an SBS/phone/email convo or we get a garbage username, don't do anything
            if (username === '' || username.includes('@')) {
              return
            }

            UsersConstants.useState.getState().dispatch.getBio(username)
          }
        }

        const updateOrangeAfterSelected = () => {
          get().dispatch.setContainsLatestMessage(true)
          const {readMsgID, maxVisibleMsgID} = get().meta
          logger.info(
            `rootReducer: selectConversation: setting orange line: convID: ${conversationIDKey} maxVisible: ${maxVisibleMsgID} read: ${readMsgID}`
          )
          if (maxVisibleMsgID > readMsgID) {
            // Store the message ID that will display the orange line above it,
            // which is the first message after the last read message. We can't
            // just increment `readMsgID` since that msgID might be a
            // non-visible (edit, delete, reaction...) message so we scan the
            // ordinals for the appropriate value.
            const messageMap = getReduxState().chat2.messageMap.get(conversationIDKey)
            const ordinals = get().messageOrdinals
            const ord =
              messageMap &&
              ordinals?.find(o => {
                const message = messageMap.get(o)
                return !!(message && message.id >= readMsgID + 1)
              })
            const message = ord ? messageMap?.get(ord) : null
            if (message?.id) {
              get().dispatch.setOrangeLine(message.id)
            } else {
              get().dispatch.setOrangeLine(0)
            }
          } else {
            // If there aren't any new messages, we don't want to display an
            // orange line so remove its entry from orangeLineMap
            get().dispatch.setOrangeLine(0)
          }
        }

        const ensureSelectedTeamLoaded = () => {
          const selectedConversation = Constants.getSelectedConversation()
          const meta = Constants.getConvoState(selectedConversation).meta
          if (meta.conversationIDKey === selectedConversation) {
            const {teamID, teamname} = meta
            if (teamname) {
              TeamsConstants.useState.getState().dispatch.getMembers(teamID)
            }
          }
        }
        ensureSelectedTeamLoaded()
        get().dispatch.loadOrangeLine()
        const meta = get().meta
        const participantInfo = get().participants
        const force = meta.conversationIDKey !== conversationIDKey || participantInfo.all.length === 0
        Constants.useState.getState().dispatch.unboxRows([conversationIDKey], force)
        get().dispatch.setThreadLoadStatus(RPCChatTypes.UIChatThreadStatusTyp.none)
        get().dispatch.setMessageCenterOrdinal()
        updateOrangeAfterSelected()
        fetchConversationBio()
        Constants.useState.getState().dispatch.resetConversationErrored()
      }
      Z.ignorePromise(f())
    },
    setCommandMarkdown: md => {
      set(s => {
        s.commandMarkdown = md
      })
    },
    setCommandStatusInfo: info => {
      set(s => {
        s.commandStatus = info
      })
    },
    setContainsLatestMessage: c => {
      set(s => {
        s.containsLatestMessage = c
      })
    },
    setDraft: d => {
      set(s => {
        s.draft = d
      })
    },
    setEditing: _ordinal => {
      // clearing
      if (_ordinal === false) {
        set(s => {
          s.editing = 0
        })
        get().dispatch.resetUnsentText()
        return
      }

      const state = getReduxState()
      const conversationIDKey = get().id

      const messageMap = state.chat2.messageMap.get(conversationIDKey)

      let ordinal = 0
      // Editing last message
      if (_ordinal === true) {
        const editLastUser = useCurrentUserState.getState().username
        // Editing your last message
        const ordinals = get().messageOrdinals
        const found =
          !!ordinals &&
          findLast(ordinals, o => {
            const message = messageMap?.get(o)
            return !!(
              (message?.type === 'text' || message?.type === 'attachment') &&
              message.author === editLastUser &&
              !message.exploded &&
              message.isEditable
            )
          })
        if (!found) return
        ordinal = found
      } else {
        ordinal = _ordinal
      }

      if (!ordinal) {
        return
      }
      const message = messageMap?.get(ordinal)
      if (message?.type === 'text' || message?.type === 'attachment') {
        set(s => {
          s.editing = ordinal
        })
        if (message.type === 'text') {
          get().dispatch.setUnsentText(message.text.stringValue())
        } else if (message.type === 'attachment') {
          get().dispatch.setUnsentText(message.title)
        }
      }
    },
    setExplodingMode: (seconds, incoming) => {
      set(s => {
        s.explodingMode = seconds
      })
      if (incoming) return
      const conversationIDKey = get().id
      const f = async () => {
        logger.info(`Setting exploding mode for conversation ${conversationIDKey} to ${seconds}`)

        // unset a conversation exploding lock for this convo so we accept the new one
        get().dispatch.setExplodingModeLocked(false)

        const category = `${Common.explodingModeGregorKeyPrefix}${conversationIDKey}`
        const meta = get().meta
        const convRetention = Meta.getEffectiveRetentionPolicy(meta)
        if (seconds === 0 || seconds === convRetention.seconds) {
          // dismiss the category so we don't leave cruft in the push state
          await RPCTypes.gregorDismissCategoryRpcPromise({category})
        } else {
          // update the category with the exploding time
          try {
            await RPCTypes.gregorUpdateCategoryRpcPromise({
              body: seconds.toString(),
              category,
              dtime: {offset: 0, time: 0},
            })
            if (seconds !== 0) {
              logger.info(
                `Successfully set exploding mode for conversation ${conversationIDKey} to ${seconds}`
              )
            } else {
              logger.info(`Successfully unset exploding mode for conversation ${conversationIDKey}`)
            }
          } catch (error) {
            if (error instanceof RPCError) {
              if (seconds !== 0) {
                logger.error(
                  `Failed to set exploding mode for conversation ${conversationIDKey} to ${seconds}. Service responded with: ${error.message}`
                )
              } else {
                logger.error(
                  `Failed to unset exploding mode for conversation ${conversationIDKey}. Service responded with: ${error.message}`
                )
              }
              if (ignoreErrors.includes(error.code)) {
                return
              }
            }
            throw error
          }
        }
      }
      Z.ignorePromise(f())
    },
    setExplodingModeLocked: locked => {
      set(s => {
        s.explodingModeLock = locked ? get().explodingMode : undefined
      })
    },
    setMarkAsUnread: readMsgID => {
      // false means clear, readMsgID === undefined means last item
      set(s => {
        s.markedAsUnread = readMsgID !== false
      })
      if (readMsgID === false) {
        return
      }
      const conversationIDKey = get().id
      const f = async () => {
        if (!useConfigState.getState().loggedIn) {
          logger.info('bail on not logged in')
          return
        }
        const state = getReduxState()
        const meta = get().meta
        const unreadLineID = readMsgID ? readMsgID : meta ? meta.maxVisibleMsgID : 0
        let msgID = unreadLineID

        // Find first visible message prior to what we have marked as unread. The
        // server will use this value to calculate our badge state.
        const messageMap = state.chat2.messageMap.get(conversationIDKey)

        if (messageMap) {
          const ordinals = get().messageOrdinals
          const ord =
            messageMap &&
            ordinals &&
            findLast(ordinals, (o: Types.Ordinal) => {
              const message = messageMap.get(o)
              return !!(message && message.id < unreadLineID)
            })
          const message = ord ? messageMap?.get(ord) : undefined
          if (message) {
            msgID = message.id
          }
        } else {
          const pagination = {
            last: false,
            next: '',
            num: 2, // we need 2 items
            previous: '',
          }
          try {
            await new Promise<void>(resolve => {
              const onGotThread = (p: any) => {
                try {
                  const d = JSON.parse(p)
                  msgID = d?.messages[1]?.valid?.messageID
                  resolve()
                } catch {}
              }
              RPCChatTypes.localGetThreadNonblockRpcListener(
                {
                  incomingCallMap: {
                    'chat.1.chatUi.chatThreadCached': p => p && onGotThread(p.thread || ''),
                    'chat.1.chatUi.chatThreadFull': p => p && onGotThread(p.thread || ''),
                  },
                  params: {
                    cbMode: RPCChatTypes.GetThreadNonblockCbMode.incremental,
                    conversationID: Types.keyToConversationID(conversationIDKey),
                    identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
                    knownRemotes: [],
                    pagination,
                    pgmode: RPCChatTypes.GetThreadNonblockPgMode.server,
                    query: {
                      disablePostProcessThread: false,
                      disableResolveSupersedes: false,
                      enableDeletePlaceholders: true,
                      markAsRead: false,
                      messageIDControl: null,
                      messageTypes: Common.loadThreadMessageTypes,
                    },
                    reason: Common.reasonToRPCReason(''),
                  },
                },
                Z.dummyListenerApi
              )
                .then(() => {})
                .catch(() => {
                  resolve()
                })
            })
          } catch {}
        }

        if (!msgID) {
          logger.info(`marking unread messages ${conversationIDKey} failed due to no id`)
          return
        }

        logger.info(`marking unread messages ${conversationIDKey} ${msgID}`)
        RPCChatTypes.localMarkAsReadLocalRpcPromise({
          conversationID: Types.keyToConversationID(conversationIDKey),
          forceUnread: true,
          msgID,
        })
          .then(() => {})
          .catch(() => {})
        get().dispatch.setOrangeLine(unreadLineID)
      }
      Z.ignorePromise(f())
    },
    setMessageCenterOrdinal: m => {
      set(s => {
        s.messageCenterOrdinal = m
      })
    },
    setMessageOrdinals: os => {
      set(s => {
        if (!shallowEqual(s.messageOrdinals, os)) {
          s.messageOrdinals = os
        }
      })
    },
    setMessageTypeMap: (o, t) => {
      set(s => {
        if (t) {
          s.messageTypeMap.set(o, t)
        } else {
          s.messageTypeMap.delete(o)
        }
      })
    },
    setMeta: _m => {
      // see updatemeta
      const m = _m ?? Meta.makeConversationMeta()
      set(s => {
        s.meta = m
      })
      get().dispatch.setDraft(get().meta.draft)
      get().dispatch.setMuted(get().meta.isMuted)
    },
    setMoreToLoad: m => {
      set(s => {
        s.moreToLoad = m
      })
    },
    setMuted: m => {
      set(s => {
        s.muted = m
      })
    },
    setOrangeLine: o => {
      set(s => {
        s.orangeLine = o
      })
    },
    setParticipants: p => {
      set(s => {
        if (!isEqual(s.participants, p)) {
          s.participants = p
        }
      })
    },
    setPendingOutboxToOrdinal: p => {
      set(s => {
        s.pendingOutboxToOrdinal = p
      })
    },
    setReplyTo: o => {
      set(s => {
        s.replyTo = o
      })
    },
    setThreadLoadStatus: status => {
      set(s => {
        s.threadLoadStatus = status
      })
    },
    setThreadSearchQuery: query => {
      set(s => {
        s.threadSearchQuery = query
      })
    },
    setTyping: t => {
      set(s => {
        if (!isEqual(s.typing, t)) {
          s.typing = t
        }
      })
    },
    setUnsentText: u => {
      set(s => {
        s.unsentText = u
      })
    },
    threadSearch: query => {
      set(s => {
        s.threadSearchInfo.hits = []
      })
      const f = async () => {
        const ConfigConstants = await import('../config')
        const conversationIDKey = get().id
        const getLastOrdinal = () => get().messageOrdinals?.at(-1) ?? 0
        const username = ConfigConstants.useCurrentUserState.getState().username
        const devicename = ConfigConstants.useCurrentUserState.getState().deviceName
        const onDone = () => {
          set(s => {
            s.threadSearchInfo.status = 'done'
          })
        }
        try {
          await RPCChatTypes.localSearchInboxRpcListener(
            {
              incomingCallMap: {
                'chat.1.chatUi.chatSearchDone': onDone,
                'chat.1.chatUi.chatSearchHit': hit => {
                  const message = Message.uiMessageToMessage(
                    conversationIDKey,
                    hit.searchHit.hitMessage,
                    username,
                    getLastOrdinal,
                    devicename
                  )

                  if (message) {
                    set(s => {
                      s.threadSearchInfo.hits = [message]
                    })
                  }
                },
                'chat.1.chatUi.chatSearchInboxDone': onDone,
                'chat.1.chatUi.chatSearchInboxHit': resp => {
                  const messages = (resp.searchHit.hits || []).reduce<Array<Types.Message>>((l, h) => {
                    const uiMsg = Message.uiMessageToMessage(
                      conversationIDKey,
                      h.hitMessage,
                      username,
                      getLastOrdinal,
                      devicename
                    )
                    if (uiMsg) {
                      l.push(uiMsg)
                    }
                    return l
                  }, [])
                  set(s => {
                    if (messages.length > 0) {
                      s.threadSearchInfo.hits = messages
                    }
                  })
                },
                'chat.1.chatUi.chatSearchInboxStart': () => {
                  set(s => {
                    s.threadSearchInfo.status = 'inprogress'
                  })
                },
              },
              params: {
                identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
                namesOnly: false,
                opts: {
                  afterContext: 0,
                  beforeContext: 0,
                  convID: Types.keyToConversationID(conversationIDKey),
                  isRegex: false,
                  matchMentions: false,
                  maxBots: 0,
                  maxConvsHit: 0,
                  maxConvsSearched: 0,
                  maxHits: 1000,
                  maxMessages: -1,
                  maxNameConvs: 0,
                  maxTeams: 0,
                  reindexMode: RPCChatTypes.ReIndexingMode.postsearchSync,
                  sentAfter: 0,
                  sentBefore: 0,
                  sentBy: '',
                  sentTo: '',
                  skipBotCache: false,
                },
                query,
              },
            },
            Z.dummyListenerApi
          )
        } catch (error) {
          if (error instanceof RPCError) {
            logger.error('search failed: ' + error.message)
            set(s => {
              s.threadSearchInfo.status = 'done'
            })
          }
        }
      }
      Z.ignorePromise(f())
    },
    toggleThreadSearch: hide => {
      set(s => {
        const {threadSearchInfo} = s
        threadSearchInfo.hits = []
        threadSearchInfo.status = 'initial'
        if (hide !== undefined) {
          threadSearchInfo.visible = !hide
        } else {
          threadSearchInfo.visible = !threadSearchInfo.visible
        }
        s.messageCenterOrdinal = undefined
      })

      const f = async () => {
        const visible = get().threadSearchInfo.visible
        if (!visible) {
          await RPCChatTypes.localCancelActiveSearchRpcPromise()
        }
      }
      Z.ignorePromise(f())
    },
    unfurlTogglePrompt: (messageID, domain, show) => {
      set(s => {
        const prompts = mapGetEnsureValue(s.unfurlPrompt, messageID, new Set())
        if (show) {
          prompts.add(domain)
        } else {
          prompts.delete(domain)
        }
      })
    },
    unreadUpdated: unread => {
      set(s => {
        s.unread = unread
      })
    },
    updateAttachmentViewTransfer: (msgId, ratio) => {
      set(s => {
        const viewType = RPCChatTypes.GalleryItemTyp.doc
        const info = mapGetEnsureValue(s.attachmentViewMap, viewType, makeAttachmentViewInfo())
        const {messages} = info
        const idx = messages.findIndex(item => item.id === msgId)
        if (idx !== -1) {
          const m = messages[idx]
          if (m!.type === 'attachment') {
            m.transferState = 'downloading'
            m.transferProgress = ratio
          }
        }
      })
    },
    updateAttachmentViewTransfered: (msgId, path) => {
      set(s => {
        const viewType = RPCChatTypes.GalleryItemTyp.doc
        const info = mapGetEnsureValue(s.attachmentViewMap, viewType, makeAttachmentViewInfo())
        const {messages} = info
        const idx = messages.findIndex(item => item.id === msgId)
        if (idx !== -1) {
          const m = messages[idx]
          if (m!.type === 'attachment') {
            m.downloadPath = path
            m.fileURLCached = true
            m.transferProgress = 0
            m.transferState = undefined
          }
        }
      })
    },
    updateMeta: (m: Partial<Types.ConversationMeta>) => {
      // see setmeta
      set(s => {
        const keys = Object.keys(m) as Array<keyof Types.ConversationMeta>
        keys.forEach(k => {
          // @ts-ignore
          s.meta[k] = m[k]
        })
      })
      get().dispatch.setDraft(get().meta.draft)
      get().dispatch.setMuted(get().meta.isMuted)
    },
  }
  return {
    ...initialConvoStore,
    dispatch,
    getEditInfo: () => {
      const ordinal = get().editing
      if (!ordinal) {
        return
      }

      const id = get().id
      const message = Common.getMessage(getReduxState(), id, ordinal)
      if (!message) {
        return
      }
      switch (message.type) {
        case 'text':
          return {exploded: message.exploded, ordinal, text: message.text.stringValue()}
        case 'attachment':
          return {exploded: message.exploded, ordinal, text: message.title}
        default:
          return
      }
    },
    getExplodingMode: (): number => {
      const mode = get().explodingModeLock ?? get().explodingMode
      const meta = get().meta
      const convRetention = Meta.getEffectiveRetentionPolicy(meta)
      return convRetention.type === 'explode' ? Math.min(mode || Infinity, convRetention.seconds) : mode
    },
  }
}

type MadeStore = UseBoundStore<StoreApi<ConvoState>>
export const stores = new Map<Types.ConversationIDKey, MadeStore>()

const createConvoStore = (id: Types.ConversationIDKey) => {
  const existing = stores.get(id)
  if (existing) return existing
  const next = Z.createZustand<ConvoState>(createSlice)
  next.setState({id})
  stores.set(id, next)
  return next
}

// non reactive call, used in actions/dispatches
export function getConvoState(id: Types.ConversationIDKey) {
  const store = createConvoStore(id)
  return store.getState()
}

const Context = React.createContext<MadeStore | null>(null)

type ConvoProviderProps = React.PropsWithChildren<{id: Types.ConversationIDKey; canBeNull?: boolean}>
export function Provider({canBeNull, children, ...props}: ConvoProviderProps) {
  if (!canBeNull && (!props.id || props.id === noConversationIDKey)) {
    throw new Error('No convo id in provider')
  }
  return <Context.Provider value={createConvoStore(props.id)}>{children}</Context.Provider>
}

// use this if in doubt
export function useContext<T>(
  selector: (state: ConvoState) => T,
  equalityFn?: (left: T, right: T) => boolean
): T {
  const store = React.useContext(Context)
  if (!store) throw new Error('Missing ConvoContext.Provider in the tree')
  return useStore(store, selector, equalityFn)
}

// unusual, usually you useContext, but maybe in teams
export function useConvoState<T>(
  id: Types.ConversationIDKey,
  selector: (state: ConvoState) => T,
  equalityFn?: (left: T, right: T) => boolean
): T {
  const store = createConvoStore(id)
  return useStore(store, selector, equalityFn)
}
