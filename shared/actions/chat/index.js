// @flow
import * as Attachment from './attachment'
import * as ChatTypes from '../../constants/types/flow-types-chat'
import * as Constants from '../../constants/chat'
import * as ChatGen from '../chat-gen'
import * as KBFSGen from '../kbfs-gen'
import * as Inbox from './inbox'
import * as ManageThread from './manage-thread'
import * as RPCTypes from '../../constants/types/flow-types'
import * as Saga from '../../util/saga'
import * as Search from './search'
import * as Selectors from '../../constants/selectors'
import * as SendMessages from './send-messages'
import * as ThreadContent from './thread-content'
import engine from '../../engine'
import some from 'lodash/some'
import {parseFolderNameToUsers} from '../../util/kbfs'
import {publicFolderWithUsers, privateFolderWithUsers, teamFolder} from '../../constants/config'

function* _incomingTyping(action: ChatGen.IncomingTypingPayload): Saga.SagaGenerator<any, any> {
  // $FlowIssue
  for (const activity of action.payload.activity) {
    const conversationIDKey = Constants.conversationIDToKey(activity.convID)
    const typers = activity.typers || []
    const typing = typers.map(typer => typer.username)
    yield Saga.put(ChatGen.createSetTypers({conversationIDKey, typing}))
  }
}

function* _setupChatHandlers(): Saga.SagaGenerator<any, any> {
  engine().setIncomingActionCreator('chat.1.NotifyChat.NewChatActivity', ({activity}) =>
    ChatGen.createIncomingMessage({activity})
  )

  engine().setIncomingActionCreator('chat.1.NotifyChat.ChatTypingUpdate', ({typingUpdates}) =>
    ChatGen.createIncomingTyping({activity: typingUpdates})
  )

  engine().setIncomingActionCreator('chat.1.NotifyChat.ChatIdentifyUpdate', ({update}) => {
    const usernames = update.CanonicalName.split(',')
    const broken = (update.breaks.breaks || []).map(b => b.user.username)
    const userToBroken = usernames.reduce((map, name) => {
      map[name] = !!broken.includes(name)
      return map
    }, {})
    return ChatGen.createUpdateBrokenTracker({userToBroken})
  })

  engine().setIncomingActionCreator('chat.1.NotifyChat.ChatTLFFinalize', ({convID}) =>
    ChatGen.createGetInboxAndUnbox({conversationIDKeys: [Constants.conversationIDToKey(convID)]})
  )

  engine().setIncomingActionCreator('chat.1.NotifyChat.ChatInboxStale', () =>
    ChatGen.createInboxStale({reason: 'service invoked'})
  )

  engine().setIncomingActionCreator(
    'chat.1.NotifyChat.ChatTLFResolve',
    ({convID, resolveInfo: {newTLFName}}) => ChatGen.createInboxStale({reason: 'TLF resolve notification'})
  )

  engine().setIncomingActionCreator('chat.1.NotifyChat.ChatThreadsStale', ({updates}) => {
    if (updates) {
      return ChatGen.createMarkThreadsStale({updates})
    }
    return null
  })

  engine().setIncomingActionCreator('chat.1.NotifyChat.ChatInboxSynced', ({syncRes}) => {
    switch (syncRes.syncType) {
      case ChatTypes.commonSyncInboxResType.clear:
        return ChatGen.createInboxStale({reason: 'sync with clear result'})
      case ChatTypes.commonSyncInboxResType.current:
        return ChatGen.createSetInboxGlobalUntrustedState({inboxGlobalUntrustedState: 'loaded'})
      case ChatTypes.commonSyncInboxResType.incremental:
        return ChatGen.createInboxSynced({convs: syncRes.incremental.items})
    }
    return ChatGen.createInboxStale({reason: 'sync with unknown result'})
  })

  engine().setIncomingActionCreator('chat.1.NotifyChat.ChatInboxSyncStarted', () => {
    return ChatGen.createSetInboxGlobalUntrustedState({inboxGlobalUntrustedState: 'loading'})
  })

  engine().setIncomingActionCreator('chat.1.NotifyChat.ChatJoinedConversation', () =>
    ChatGen.createInboxStale({reason: 'joined a conversation'})
  )
  engine().setIncomingActionCreator('chat.1.NotifyChat.ChatLeftConversation', () =>
    ChatGen.createInboxStale({reason: 'left a conversation'})
  )
}

function* _openTlfInChat(action: ChatGen.OpenTlfInChatPayload): Saga.SagaGenerator<any, any> {
  const {payload: {tlf, isTeam}} = action
  if (isTeam) {
    yield Saga.put(ChatGen.createOpenTeamConversation({teamname: tlf, channelname: 'general'}))
    return
  }
  const me = yield Saga.select(Selectors.usernameSelector)
  const userlist = parseFolderNameToUsers(me, tlf)
  const users = userlist.map(u => u.username)
  if (some(userlist, 'readOnly')) {
    console.warn('Bug: openTlfToChat should never be called on a convo with readOnly members.')
    return
  }
  yield Saga.put(ChatGen.createStartConversation({users}))
}

function* _openFolder(): Saga.SagaGenerator<any, any> {
  const conversationIDKey = yield Saga.select(Constants.getSelectedConversation)

  const inbox = yield Saga.select(Constants.getInbox, conversationIDKey)
  if (inbox) {
    let path
    if (inbox.membersType === ChatTypes.commonConversationMembersType.team) {
      path = teamFolder(inbox.teamname)
    } else {
      const helper = inbox.visibility === RPCTypes.commonTLFVisibility.public
        ? publicFolderWithUsers
        : privateFolderWithUsers
      path = helper(inbox.get('participants').toArray())
    }
    yield Saga.put(KBFSGen.createOpen({path}))
  } else {
    throw new Error(`Can't find conversation path`)
  }
}

function* chatSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.fork(Inbox.registerSagas)
  yield Saga.fork(SendMessages.registerSagas)
  yield Saga.fork(Attachment.registerSagas)
  yield Saga.fork(ThreadContent.registerSagas)
  yield Saga.fork(Search.registerSagas)
  yield Saga.fork(ManageThread.registerSagas)

  yield Saga.safeTakeEvery(ChatGen.incomingTyping, _incomingTyping)
  yield Saga.safeTakeEvery(ChatGen.openFolder, _openFolder)
  yield Saga.safeTakeEvery(ChatGen.openTlfInChat, _openTlfInChat)
  yield Saga.safeTakeEvery(ChatGen.setupChatHandlers, _setupChatHandlers)
}

export default chatSaga
