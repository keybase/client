// @flow
import * as Attachment from './attachment'
import * as ChatTypes from '../../constants/types/flow-types-chat'
import * as Constants from '../../constants/chat'
import * as Creators from './creators'
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
import {openInKBFS} from '../kbfs'
import {parseFolderNameToUsers} from '../../util/kbfs'
import {publicFolderWithUsers, privateFolderWithUsers, teamFolder} from '../../constants/config'

function* _incomingTyping(action: Constants.IncomingTyping): Saga.SagaGenerator<any, any> {
  // $FlowIssue
  for (const activity of action.payload.activity) {
    const conversationIDKey = Constants.conversationIDToKey(activity.convID)
    const typers = activity.typers || []
    const typing = typers.map(typer => typer.username)
    yield Saga.put(Creators.setTypers(conversationIDKey, typing))
  }
}

function* _setupChatHandlers(): Saga.SagaGenerator<any, any> {
  engine().setIncomingActionCreator('chat.1.NotifyChat.NewChatActivity', ({activity}) =>
    Creators.incomingMessage(activity)
  )

  engine().setIncomingActionCreator('chat.1.NotifyChat.ChatTypingUpdate', ({typingUpdates}) =>
    Creators.incomingTyping(typingUpdates)
  )

  engine().setIncomingActionCreator('chat.1.NotifyChat.ChatIdentifyUpdate', ({update}) => {
    const usernames = update.CanonicalName.split(',')
    const broken = (update.breaks.breaks || []).map(b => b.user.username)
    const userToBroken = usernames.reduce((map, name) => {
      map[name] = !!broken.includes(name)
      return map
    }, {})
    return Creators.updateBrokenTracker(userToBroken)
  })

  engine().setIncomingActionCreator('chat.1.NotifyChat.ChatTLFFinalize', ({convID}) =>
    Creators.getInboxAndUnbox([Constants.conversationIDToKey(convID)])
  )

  engine().setIncomingActionCreator('chat.1.NotifyChat.ChatInboxStale', () =>
    Creators.inboxStale('service invoked')
  )

  engine().setIncomingActionCreator(
    'chat.1.NotifyChat.ChatTLFResolve',
    ({convID, resolveInfo: {newTLFName}}) => Creators.inboxStale('TLF resolve notification')
  )

  engine().setIncomingActionCreator('chat.1.NotifyChat.ChatThreadsStale', ({updates}) => {
    if (updates) {
      return Creators.markThreadsStale(updates)
    }
    return null
  })

  engine().setIncomingActionCreator('chat.1.NotifyChat.ChatInboxSynced', ({syncRes}) => {
    switch (syncRes.syncType) {
      case ChatTypes.CommonSyncInboxResType.clear:
        return Creators.inboxStale('sync with clear result')
      case ChatTypes.CommonSyncInboxResType.current:
        return Creators.setInboxGlobalUntrustedState('loaded')
      case ChatTypes.CommonSyncInboxResType.incremental:
        return Creators.inboxSynced(syncRes.incremental.items)
    }
    return Creators.inboxStale('sync with unknown result')
  })

  engine().setIncomingActionCreator('chat.1.NotifyChat.ChatInboxSyncStarted', () => {
    return Creators.setInboxGlobalUntrustedState('loading')
  })

  engine().setIncomingActionCreator('chat.1.NotifyChat.ChatJoinedConversation', () =>
    Creators.inboxStale('joined a conversation')
  )
  engine().setIncomingActionCreator('chat.1.NotifyChat.ChatLeftConversation', () =>
    Creators.inboxStale('left a conversation')
  )
}

function* _openTlfInChat(action: Constants.OpenTlfInChat): Saga.SagaGenerator<any, any> {
  const tlf = action.payload
  const me = yield Saga.select(Selectors.usernameSelector)
  const userlist = parseFolderNameToUsers(me, tlf)
  const users = userlist.map(u => u.username)
  if (some(userlist, 'readOnly')) {
    console.warn('Bug: openTlfToChat should never be called on a convo with readOnly members.')
    return
  }
  yield Saga.put(Creators.startConversation(users))
}

function* _openFolder(): Saga.SagaGenerator<any, any> {
  const conversationIDKey = yield Saga.select(Constants.getSelectedConversation)

  const inbox = yield Saga.select(Constants.getInbox, conversationIDKey)
  if (inbox) {
    let path
    if (inbox.membersType === ChatTypes.CommonConversationMembersType.team) {
      path = teamFolder(inbox.teamname)
    } else {
      const helper = inbox.visibility === RPCTypes.CommonTLFVisibility.public
        ? publicFolderWithUsers
        : privateFolderWithUsers
      path = helper(inbox.get('participants').toArray())
    }
    yield Saga.put(openInKBFS(path))
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

  yield Saga.safeTakeEvery('chat:incomingTyping', _incomingTyping)
  yield Saga.safeTakeEvery('chat:openFolder', _openFolder)
  yield Saga.safeTakeEvery('chat:openTlfInChat', _openTlfInChat)
  yield Saga.safeTakeEvery('chat:setupChatHandlers', _setupChatHandlers)
}

export default chatSaga

export {badgeAppForChat, openTlfInChat, setupChatHandlers, startConversation} from './creators'
