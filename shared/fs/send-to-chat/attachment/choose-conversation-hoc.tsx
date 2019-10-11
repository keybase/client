import * as FsGen from '../../../actions/fs-gen'
import * as ChatTypes from '../../../constants/types/chat2'
import * as Container from '../../../util/container'

type OwnProps = {}

export default function(component: any) {
  return Container.namedConnect(
    state => ({
      _sendAttachmentToChat: state.fs.sendAttachmentToChat,
    }),
    dispatch => ({
      onSelect: (convID: ChatTypes.ConversationIDKey) =>
        dispatch(FsGen.createSetSendAttachmentToChatConvID({convID})),
      onSetFilter: (filter: string) => dispatch(FsGen.createSetSendAttachmentToChatFilter({filter})),
    }),
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
