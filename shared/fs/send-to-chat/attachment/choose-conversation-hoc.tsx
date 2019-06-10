import * as React from 'react'
import * as FsGen from '../../../actions/fs-gen'
import * as ChatTypes from '../../../constants/types/chat2'
import * as Container from '../../../util/container'

type OwnProps = {}

const mapStateToProps = (state: Container.TypedState) => ({
  _conv: state.chat2.metaMap.get(state.fs.sendAttachmentToChat.convID),
  _sendAttachmentToChat: state.fs.sendAttachmentToChat,
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch, ownProps: OwnProps) => ({
  onSelect: (convID: ChatTypes.ConversationIDKey) =>
    dispatch(FsGen.createSetSendAttachmentToChatConvID({convID})),
  onSetFilter: (filter: string) => dispatch(FsGen.createSetSendAttachmentToChatFilter({filter})),
})

type InjectedProps = {
  filter?: string
  onSelect: (convID: ChatTypes.ConversationIDKey) => void
  onSetFilter?: (filter: string) => void
  selected: ChatTypes.ConversationIDKey
}

type WithInjectedProps<OriginalProps> = OriginalProps & InjectedProps

export default function(component: any) {
  return Container.namedConnect(
    mapStateToProps,
    mapDispatchToProps,
    (stateProps, dispatchProps, ownProps: OwnProps) => ({
      ...ownProps,
      filter: stateProps._sendAttachmentToChat.filter,
      onSelect: dispatchProps.onSelect,
      onSetFilter: dispatchProps.onSetFilter,
      selected: stateProps._sendAttachmentToChat.convID,
    }),
    'ChooseConversationHOC'
  )(component) as any
}
