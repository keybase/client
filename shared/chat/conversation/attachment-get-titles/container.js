// @flow
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Constants from '../../../constants/chat2'
import * as Types from '../../../constants/types/chat2'
import * as FsTypes from '../../../constants/types/fs'
import GetTitles from './'
import {connect} from '../../../util/container'
import {navigateUp} from '../../../actions/route-tree'
import {type RouteProps} from '../../../route-tree/render-route'
import type {PathToInfo} from '.'

type OwnProps = RouteProps<
  {pathAndOutboxIDs: Array<Types.PathAndOutboxID>, conversationIDKey: Types.ConversationIDKey},
  {}
>

const mapStateToProps = (state, {routeProps}: OwnProps) => ({
  _conversationIDKey: routeProps.get('conversationIDKey'),
  pathAndOutboxIDs: routeProps.get('pathAndOutboxIDs'),
})

const mapDispatchToProps = dispatch => ({
  _onSubmit: (conversationIDKey: Types.ConversationIDKey, pathToInfo: PathToInfo) => {
    const paths = Object.keys(pathToInfo)
    const pathAndOutboxIDs = paths.map(p => ({
      path: p,
      outboxID: pathToInfo[p].outboxID,
    }))
    const titles = paths.map(p => pathToInfo[p].title)
    dispatch(
      Chat2Gen.createAttachmentsUpload({
        conversationIDKey,
        paths: pathAndOutboxIDs,
        titles,
      })
    )
    dispatch(navigateUp())
  },
  onCancel: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  onCancel: dispatchProps.onCancel,
  onSubmit: (pathToInfo: PathToInfo) => dispatchProps._onSubmit(stateProps._conversationIDKey, pathToInfo),
  pathToInfo: stateProps.pathAndOutboxIDs.reduce((map, {path, outboxID}) => {
    const filename = FsTypes.getLocalPathName(path)
    map[path] = {
      filename,
      title: '',
      type: Constants.pathToAttachmentType(path),
      outboxID: outboxID,
    }
    return map
  }, {}),
  title: 'Attachments',
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(GetTitles)
