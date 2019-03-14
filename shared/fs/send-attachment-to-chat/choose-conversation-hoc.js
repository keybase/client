// @flow
import * as React from 'react'
import * as FsGen from '../../actions/fs-gen'
import * as ChatTypes from '../../constants/types/chat2'
import {namedConnect} from '../../util/container'

const mapStateToProps = state => ({
  _conv: state.chat2.metaMap.get(state.fs.sendAttachmentToChat.convID),
  _sendAttachmentToChat: state.fs.sendAttachmentToChat,
})

const mapDispatchToProps = (dispatch, ownProps) => ({
  onSelect: (convID: ChatTypes.ConversationIDKey) =>
    dispatch(FsGen.createSetSendAttachmentToChatConvID({convID})),
  onSetFilter: (filter: string) => dispatch(FsGen.createSetSendAttachmentToChatFilter({filter})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...ownProps,
  filter: stateProps._sendAttachmentToChat.filter,
  onSelect: dispatchProps.onSelect,
  onSetFilter: dispatchProps.onSetFilter,
  selected: stateProps._sendAttachmentToChat.convID,
})

type InjectedProps = {
  filter?: string,
  onSelect: (convID: ChatTypes.ConversationIDKey) => void,
  onSetFilter?: (filter: string) => void,
  selected: ChatTypes.ConversationIDKey,
}

type WithInjectedProps<OriginalProps> = {|
  ...$Exact<OriginalProps>,
  ...$Exact<InjectedProps>,
|}

export default function<WrappedOwnProps>(
  component: React.ComponentType<WithInjectedProps<WrappedOwnProps>>
): React.AbstractComponent<WrappedOwnProps> {
  return namedConnect<WrappedOwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps,
    'ChooseConversationHOC'
  )(component)
}
