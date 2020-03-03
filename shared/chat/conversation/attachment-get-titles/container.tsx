import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Constants from '../../../constants/chat2'
import * as Types from '../../../constants/types/chat2'
import * as FsTypes from '../../../constants/types/fs'
import GetTitles from '.'
import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Tabs from '../../../constants/tabs'

type OwnProps = Container.RouteProps<{
  conversationIDKey: Types.ConversationIDKey
  pathAndOutboxIDs: Array<Types.PathAndOutboxID>
  selectConversationWithReason?: 'extension' | 'files'
}>

const noOutboxIds: Array<Types.PathAndOutboxID> = []

const mapStateToProps = (_: Container.TypedState, ownProps: OwnProps) => ({
  _conversationIDKey: Container.getRouteProps(ownProps, 'conversationIDKey', Constants.noConversationIDKey),
  pathAndOutboxIDs: Container.getRouteProps(ownProps, 'pathAndOutboxIDs', noOutboxIds),
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch, ownProps: OwnProps) => {
  const conversationIDKey = Container.getRouteProps(
    ownProps,
    'conversationIDKey',
    Constants.noConversationIDKey
  )
  const pathAndOutboxIDs = Container.getRouteProps(ownProps, 'pathAndOutboxIDs', noOutboxIds)
  const selectConversationWithReason = Container.getRouteProps(
    ownProps,
    'selectConversationWithReason',
    undefined
  )
  return {
    onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
    onSubmit: (titles: Array<string>) => {
      dispatch(
        Chat2Gen.createAttachFromDragAndDrop({
          conversationIDKey,
          paths: pathAndOutboxIDs,
          titles,
        })
      )
      dispatch(RouteTreeGen.createClearModals())

      if (selectConversationWithReason) {
        dispatch(
          RouteTreeGen.createResetStack({
            actions: [],
            index: 0,
            tab: Tabs.chatTab,
          })
        )
        dispatch(Chat2Gen.createSelectConversation({conversationIDKey, reason: selectConversationWithReason}))
      }
    },
  }
}

export default Container.connect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, _: OwnProps) => ({
    onCancel: dispatchProps.onCancel,
    onSubmit: dispatchProps.onSubmit,
    pathAndInfos: stateProps.pathAndOutboxIDs.map(({path, outboxID}) => {
      const filename = FsTypes.getLocalPathName(path)
      return {
        info: {
          filename,
          outboxID: outboxID,
          title: '',
          type: Constants.pathToAttachmentType(path),
        },
        path,
      }
    }),
    title: 'Attachments',
  })
)(GetTitles)
