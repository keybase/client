// @flow
import logger from '../../logger'
import * as Attachment from './attachment'
import * as ChatTypes from '../../constants/types/rpc-chat-gen'
import * as Constants from '../../constants/chat'
import * as ChatGen from '../chat-gen'
import * as KBFSGen from '../kbfs-gen'
import * as ManageThread from './manage-thread'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Saga from '../../util/saga'
import * as Search from './search'
import * as Selectors from '../../constants/selectors'
import * as SendMessages from './send-messages'
import * as ThreadContent from './thread-content'
import engine from '../../engine'
import some from 'lodash/some'
import {parseFolderNameToUsers} from '../../util/kbfs'
import {publicFolderWithUsers, privateFolderWithUsers, teamFolder} from '../../constants/config'
import type {TypedState} from '../../constants/reducer'

function _incomingTyping(action: ChatGen.IncomingTypingPayload) {
  const actions = []
  // $FlowIssue
  for (const activity of action.payload.activity) {
    const conversationIDKey = Constants.conversationIDToKey(activity.convID)
    const typers = activity.typers || []
    const typing = typers.map(typer => typer.username)
    actions.push(Saga.put(ChatGen.createSetTypers({conversationIDKey, typing})))
  }
  return Saga.sequentially(actions)
}

function _setupChatHandlers() {
  engine().setIncomingActionCreators('chat.1.NotifyChat.ChatTypingUpdate', ({typingUpdates}) => [
    ChatGen.createIncomingTyping({activity: typingUpdates}),
  ])

  engine().setIncomingActionCreators('chat.1.NotifyChat.ChatIdentifyUpdate', ({update}) => {
    const usernames = update.CanonicalName.split(',')
    const broken = (update.breaks.breaks || []).map(b => b.user.username)
    const userToBroken = usernames.reduce((map, name) => {
      map[name] = !!broken.includes(name)
      return map
    }, {})
    return [ChatGen.createUpdateBrokenTracker({userToBroken})]
  })

  engine().setIncomingActionCreators('chat.1.NotifyChat.ChatInboxStale', () => [
    // TODO
    // ChatGen.createInboxStale({reason: 'service invoked'}),
  ])

  engine().setIncomingActionCreators(
    'chat.1.NotifyChat.ChatTLFResolve',
    ({convID, resolveInfo: {newTLFName}}) => [
      /* TODO ChatGen.createInboxStale({reason: 'TLF resolve notification'}) */
    ]
  )

  engine().setIncomingActionCreators('chat.1.NotifyChat.ChatThreadsStale', ({updates}) => {
    if (updates) {
      return [ChatGen.createMarkThreadsStale({updates})]
    }
    return null
  })

  engine().setIncomingActionCreators('chat.1.NotifyChat.ChatInboxSynced', ({syncRes}) => {
    switch (syncRes.syncType) {
      case ChatTypes.commonSyncInboxResType.clear:
        return null // TODO [ChatGen.createInboxStale({reason: 'sync with clear result'})]
      case ChatTypes.commonSyncInboxResType.current:
        return null // TODO [ChatGen.createSetInboxSyncingState({inboxSyncingState: 'notSyncing'})]
      case ChatTypes.commonSyncInboxResType.incremental:
        return null // TODO[ChatGen.createInboxSynced({convs: syncRes.incremental.items})]
    }
    return null // TODO [ChatGen.createInboxStale({reason: 'sync with unknown result'})]
  })

  engine().setIncomingActionCreators('chat.1.NotifyChat.ChatInboxSyncStarted', () => [
    ChatGen.createSetInboxSyncingState({inboxSyncingState: 'syncing'}),
  ])

  engine().setIncomingActionCreators(
    'chat.1.NotifyChat.ChatJoinedConversation',
    () => null // TODO [
    // ChatGen.createInboxStale({reason: 'joined a conversation'}),
    // ])
  )
  engine().setIncomingActionCreators('chat.1.NotifyChat.ChatLeftConversation', () => null) // TODO[
  // ChatGen.createInboxStale({reason: 'left a conversation'}),
  // ])
}

function _openTlfInChat(action: ChatGen.OpenTlfInChatPayload, state: TypedState) {
  const {payload: {tlf, isTeam}} = action
  if (isTeam) {
    return Saga.put(ChatGen.createOpenTeamConversation({teamname: tlf, channelname: 'general'}))
  }
  const me = Selectors.usernameSelector(state)
  const userlist = parseFolderNameToUsers(me, tlf)
  const users = userlist.map(u => u.username)
  if (some(userlist, 'readOnly')) {
    logger.error('Bug: openTlfToChat should never be called on a convo with readOnly members.')
    return
  }
  return Saga.put(ChatGen.createStartConversation({users}))
}

function _openFolder(_: ChatGen.OpenFolderPayload, state: TypedState) {
  const conversationIDKey = Constants.getSelectedConversation(state)
  const inbox = Constants.getInbox(state, conversationIDKey)
  if (inbox) {
    let path
    if (inbox.membersType === ChatTypes.commonConversationMembersType.team) {
      if (!inbox.teamname) {
        throw new Error(`Can't find conversation path`)
      }
      path = teamFolder(inbox.teamname)
    } else {
      const helper =
        inbox.visibility === RPCTypes.commonTLFVisibility.public
          ? publicFolderWithUsers
          : privateFolderWithUsers
      path = helper(inbox.get('participants').toArray())
    }
    return Saga.put(KBFSGen.createOpen({path}))
  } else {
    throw new Error(`Can't find conversation path`)
  }
}

function* chatSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.fork(SendMessages.registerSagas)
  yield Saga.fork(Attachment.registerSagas)
  yield Saga.fork(ThreadContent.registerSagas)
  yield Saga.fork(Search.registerSagas)
  yield Saga.fork(ManageThread.registerSagas)

  yield Saga.safeTakeEveryPure(ChatGen.incomingTyping, _incomingTyping)
  yield Saga.safeTakeEveryPure(ChatGen.openFolder, _openFolder)
  yield Saga.safeTakeEveryPure(ChatGen.openTlfInChat, _openTlfInChat)
  yield Saga.safeTakeEveryPure(ChatGen.setupChatHandlers, _setupChatHandlers)
}

export default chatSaga
