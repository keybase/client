import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Constants from '../../../constants/chat2'
import * as Container from '../../../util/container'
import * as FsTypes from '../../../constants/types/fs'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import GetTitles, {type Info} from '.'
import type * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import type * as Types from '../../../constants/types/chat2'

type OwnProps = Container.RouteProps<'chatAttachmentGetTitles'>

const noOutboxIds: Array<Types.PathAndOutboxID> = []

export default Container.connect(
  () => ({}),
  (dispatch: Container.TypedDispatch, ownProps: OwnProps) => {
    const conversationIDKey = ownProps.route.params?.conversationIDKey ?? Constants.noConversationIDKey
    const tlfName = ownProps.route.params?.tlfName ?? undefined
    const noDragDrop = ownProps.route.params?.noDragDrop ?? false
    const pathAndOutboxIDs = ownProps.route.params?.pathAndOutboxIDs ?? noOutboxIds
    const selectConversationWithReason = ownProps.route.params?.selectConversationWithReason ?? undefined
    return {
      onCancel: () => {
        dispatch(
          Chat2Gen.createAttachmentUploadCanceled({
            outboxIDs: pathAndOutboxIDs.reduce((l: Array<RPCChatTypes.OutboxID>, {outboxID}) => {
              if (outboxID) {
                l.push(outboxID)
              }
              return l
            }, []),
          })
        )
        dispatch(RouteTreeGen.createNavigateUp())
      },
      onSubmit: (titles: Array<string>) => {
        tlfName || noDragDrop
          ? dispatch(
              Chat2Gen.createAttachmentsUpload({
                conversationIDKey,
                paths: pathAndOutboxIDs,
                titles,
                tlfName,
              })
            )
          : dispatch(
              Chat2Gen.createAttachFromDragAndDrop({
                conversationIDKey,
                paths: pathAndOutboxIDs,
                titles,
              })
            )
        dispatch(RouteTreeGen.createClearModals())

        if (selectConversationWithReason) {
          dispatch(Chat2Gen.createNavigateToThread({conversationIDKey, reason: selectConversationWithReason}))
        }
      },
    }
  },
  (_, dispatchProps, ownProps: OwnProps) => {
    const pathAndOutboxIDs = ownProps.route.params?.pathAndOutboxIDs ?? noOutboxIds
    return {
      onCancel: dispatchProps.onCancel,
      onSubmit: dispatchProps.onSubmit,
      pathAndInfos: pathAndOutboxIDs.map(({path, outboxID}) => {
        const filename = FsTypes.getLocalPathName(path)
        const info: Info = {
          filename,
          outboxID: outboxID,
          title: '',
          type: Constants.pathToAttachmentType(path),
        }
        return {
          info,
          path,
        }
      }),
    }
  }
)(GetTitles)
