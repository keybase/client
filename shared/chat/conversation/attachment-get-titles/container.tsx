import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Constants from '../../../constants/chat2'
import * as Types from '../../../constants/types/chat2'
import * as FsTypes from '../../../constants/types/fs'
import GetTitles, {PathToInfo} from '.'
import {connect, getRouteProps} from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import {RouteProps} from '../../../route-tree/render-route'

type OwnProps = RouteProps<
  {
    pathAndOutboxIDs: Array<Types.PathAndOutboxID>
    conversationIDKey: Types.ConversationIDKey
  },
  {}
>

const mapStateToProps = (state, ownProps: OwnProps) => ({
  _conversationIDKey: getRouteProps(ownProps, 'conversationIDKey'),
  pathAndOutboxIDs: getRouteProps(ownProps, 'pathAndOutboxIDs'),
})

const mapDispatchToProps = dispatch => ({
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

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
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

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(GetTitles)
