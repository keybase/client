import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Constants from '../../../constants/chat2'
import * as Container from '../../../util/container'
import * as FsTypes from '../../../constants/types/fs'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import GetTitles, {type Info} from '.'
import type * as Types from '../../../constants/types/chat2'
import type * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  pathAndOutboxIDs: Array<Types.PathAndOutboxID>
  selectConversationWithReason?: 'extension' | 'files'
  // If tlfName is set, we'll use Chat2Gen.createAttachmentsUpload. Otherwise
  // Chat2Gen.createAttachFromDragAndDrop is used.
  tlfName?: string
  // don't use the drag drop functionality, just upload the outbox IDs
  noDragDrop?: Boolean
}

export default (ownProps: OwnProps) => {
  const dispatch = Container.useDispatch()
  const conversationIDKey = ownProps.conversationIDKey ?? Constants.noConversationIDKey
  const tlfName = ownProps.tlfName
  const noDragDrop = ownProps.noDragDrop ?? false
  const pathAndOutboxIDs = ownProps.pathAndOutboxIDs
  const selectConversationWithReason = ownProps.selectConversationWithReason
  const onCancel = () => {
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
  }
  const onSubmit = (titles: Array<string>) => {
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
  }
  const props = {
    onCancel,
    onSubmit,
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

  return <GetTitles {...props} />
}
