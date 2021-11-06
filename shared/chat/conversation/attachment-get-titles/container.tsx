import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Constants from '../../../constants/chat2'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import * as Types from '../../../constants/types/chat2'
import * as FsTypes from '../../../constants/types/fs'
import GetTitles, {Info} from '.'
import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'

type OwnProps = Container.RouteProps<{
  conversationIDKey: Types.ConversationIDKey
  pathAndOutboxIDs: Array<Types.PathAndOutboxID>
  selectConversationWithReason?: 'extension' | 'files'
  // If tlfName is set, we'll use Chat2Gen.createAttachmentsUpload. Otherwise
  // Chat2Gen.createAttachFromDragAndDrop is used.
  tlfName?: string
  // don't use the drag drop functionality, just upload the outbox IDs
  noDragDrop?: Boolean
}>

const noOutboxIds: Array<Types.PathAndOutboxID> = []

export default Container.connect(
  () => ({}),
  (dispatch: Container.TypedDispatch, ownProps: OwnProps) => {
    const conversationIDKey = Container.getRouteProps(
      ownProps,
      'conversationIDKey',
      Constants.noConversationIDKey
    )
    const tlfName = Container.getRouteProps(ownProps, 'tlfName', undefined)
    const noDragDrop = Container.getRouteProps(ownProps, 'noDragDrop', false)
    const pathAndOutboxIDs = Container.getRouteProps(ownProps, 'pathAndOutboxIDs', noOutboxIds)
    const selectConversationWithReason = Container.getRouteProps(
      ownProps,
      'selectConversationWithReason',
      undefined
    )
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
    const pathAndOutboxIDs = Container.getRouteProps(ownProps, 'pathAndOutboxIDs', noOutboxIds)
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
