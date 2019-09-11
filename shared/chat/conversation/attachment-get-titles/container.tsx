import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Constants from '../../../constants/chat2'
import * as Types from '../../../constants/types/chat2'
import * as FsTypes from '../../../constants/types/fs'
import GetTitles, {PathToInfo} from '.'
import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'

type OwnProps = Container.RouteProps<{
  pathAndOutboxIDs: Array<Types.PathAndOutboxID>
  conversationIDKey: Types.ConversationIDKey
}>

const noOutboxIds = []

const mapStateToProps = (_: Container.TypedState, ownProps: OwnProps) => ({
  _conversationIDKey: Container.getRouteProps(ownProps, 'conversationIDKey', Constants.noConversationIDKey),
  pathAndOutboxIDs: Container.getRouteProps(ownProps, 'pathAndOutboxIDs', noOutboxIds),
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  _onSubmit: (conversationIDKey: Types.ConversationIDKey, pathToInfo: PathToInfo) => {
    const paths = Object.keys(pathToInfo)
    const pathAndOutboxIDs = paths.map(p => ({
      outboxID: pathToInfo[p].outboxID,
      path: p,
    }))
    const titles = paths.map(p => pathToInfo[p].title)
    dispatch(
      Chat2Gen.createAttachmentsUpload({
        conversationIDKey,
        paths: pathAndOutboxIDs,
        titles,
      })
    )
    dispatch(RouteTreeGen.createNavigateUp())
  },
  onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
})

export default Container.connect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, _: OwnProps) => ({
    onCancel: dispatchProps.onCancel,
    onSubmit: (pathToInfo: PathToInfo) => dispatchProps._onSubmit(stateProps._conversationIDKey, pathToInfo),
    pathToInfo: stateProps.pathAndOutboxIDs.reduce((map, {path, outboxID}) => {
      const filename = FsTypes.getLocalPathName(path)
      map[path] = {
        filename,
        outboxID: outboxID,
        title: '',
        type: Constants.pathToAttachmentType(path),
      }
      return map
    }, {}),
    title: 'Attachments',
  })
)(GetTitles)
