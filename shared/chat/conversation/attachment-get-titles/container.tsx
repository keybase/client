import * as Constants from '../../../constants/chat2'
import * as C from '../../../constants'
import * as FsTypes from '../../../constants/types/fs'
import GetTitles, {type Info} from '.'
import type * as Types from '../../../constants/types/chat2'
import type * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  pathAndOutboxIDs: Array<Types.PathAndOutboxID>
  titles?: Array<string>
  selectConversationWithReason?: 'extension' | 'files'
  // If tlfName is set, we'll use Chat2Gen.createAttachmentsUpload. Otherwise
  // Chat2Gen.createAttachFromDragAndDrop is used.
  tlfName?: string
  // don't use the drag drop functionality, just upload the outbox IDs
  noDragDrop?: Boolean
}

export default (ownProps: OwnProps) => {
  const conversationIDKey = ownProps.conversationIDKey ?? Constants.noConversationIDKey
  const {titles, tlfName, pathAndOutboxIDs} = ownProps
  const noDragDrop = ownProps.noDragDrop ?? false
  const selectConversationWithReason = ownProps.selectConversationWithReason
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const attachmentUploadCanceled = Constants.useContext(s => s.dispatch.attachmentUploadCanceled)
  const onCancel = () => {
    attachmentUploadCanceled(
      pathAndOutboxIDs.reduce((l: Array<RPCChatTypes.OutboxID>, {outboxID}) => {
        if (outboxID) {
          l.push(outboxID)
        }
        return l
      }, [])
    )
    navigateUp()
  }
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const attachmentsUpload = Constants.useContext(s => s.dispatch.attachmentsUpload)
  const attachFromDragAndDrop = Constants.useContext(s => s.dispatch.attachFromDragAndDrop)
  const onSubmit = (titles: Array<string>) => {
    tlfName || noDragDrop
      ? attachmentsUpload(pathAndOutboxIDs, titles, tlfName)
      : attachFromDragAndDrop(pathAndOutboxIDs, titles)
    clearModals()

    if (selectConversationWithReason) {
      Constants.getConvoState(conversationIDKey).dispatch.navigateToThread(selectConversationWithReason)
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
    titles,
  }

  return <GetTitles {...props} />
}
