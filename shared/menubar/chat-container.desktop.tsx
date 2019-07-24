import * as ChatTypes from '../constants/types/chat2'
import * as Chat2Gen from '../actions/chat2-gen'
import {ChatPreview} from './chat.desktop'
import {remoteConnect} from '../util/container'
import {RemoteConvMeta} from '../chat/inbox/container/remote'

type OwnProps = {
  convLimit: number
}

type State = {
  conversations: Array<RemoteConvMeta>
}

const mapStateToProps = ({conversations}: State) => ({conversations})

const mapDispatchToProps = dispatch => ({
  _onSelectConversation: (conversationIDKey: ChatTypes.ConversationIDKey) =>
    dispatch(Chat2Gen.createOpenChatFromWidget({conversationIDKey})),
  onViewAll: () => dispatch(Chat2Gen.createOpenChatFromWidget({})),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  convRows: __STORYBOOK__
    ? []
    : stateProps.conversations
        .slice(0, ownProps.convLimit ? ownProps.convLimit : stateProps.conversations.length)
        .map(c => ({
          conversationIDKey: c.conversationIDKey,
          onSelectConversation: () => dispatchProps._onSelectConversation(c.conversationIDKey),
          ...c,
        })),
  onViewAll: dispatchProps.onViewAll,
})

export default remoteConnect(mapStateToProps, mapDispatchToProps, mergeProps)(ChatPreview)
