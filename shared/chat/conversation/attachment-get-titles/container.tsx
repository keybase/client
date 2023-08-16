import * as C from '../../../constants'
import type * as T from '../../../constants/types'
import * as Constants from '../../../constants/chat2'
import * as FsTypes from '../../../constants/types/fs'
import GetTitles, {type Info} from '.'

type OwnProps = {
  conversationIDKey: T.Chat.ConversationIDKey // needed by page
  pathAndOutboxIDs: Array<T.Chat.PathAndOutboxID>
  titles?: Array<string>
  selectConversationWithReason?: 'extension' | 'files'
  // If tlfName is set, we'll use Chat2Gen.createAttachmentsUpload. Otherwise
  // Chat2Gen.createAttachFromDragAndDrop is used.
  tlfName?: string
  // don't use the drag drop functionality, just upload the outbox IDs
  noDragDrop?: Boolean
}

export default (ownProps: OwnProps) => {
  const {titles, tlfName, pathAndOutboxIDs} = ownProps
  const noDragDrop = ownProps.noDragDrop ?? false
  const selectConversationWithReason = ownProps.selectConversationWithReason
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const navigateToThread = C.useChatContext(s => s.dispatch.navigateToThread)
  const attachmentUploadCanceled = C.useChatContext(s => s.dispatch.attachmentUploadCanceled)
  const onCancel = () => {
    attachmentUploadCanceled(
      pathAndOutboxIDs.reduce((l: Array<T.RPCChat.OutboxID>, {outboxID}) => {
        if (outboxID) {
          l.push(outboxID)
        }
        return l
      }, [])
    )
    navigateUp()
  }
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const attachmentsUpload = C.useChatContext(s => s.dispatch.attachmentsUpload)
  const attachFromDragAndDrop = C.useChatContext(s => s.dispatch.attachFromDragAndDrop)
  const onSubmit = (titles: Array<string>) => {
    tlfName || noDragDrop
      ? attachmentsUpload(pathAndOutboxIDs, titles, tlfName)
      : attachFromDragAndDrop(pathAndOutboxIDs, titles)
    clearModals()

    if (selectConversationWithReason) {
      navigateToThread(selectConversationWithReason)
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
