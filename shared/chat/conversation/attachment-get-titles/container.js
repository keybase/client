// @flow
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Constants from '../../../constants/chat2'
import * as Types from '../../../constants/types/chat2'
import * as FsTypes from '../../../constants/types/fs'
import GetTitles from './'
import {connect, type TypedState} from '../../../util/container'
import {navigateUp} from '../../../actions/route-tree'
import {type RouteProps} from '../../../route-tree/render-route'
import type {PathToInfo} from '.'

type OwnProps = RouteProps<{paths: Array<string>, conversationIDKey: Types.ConversationIDKey}, {}>

const mapStateToProps = (state: TypedState, {routeProps}: OwnProps) => ({
  _conversationIDKey: routeProps.get('conversationIDKey'),
  paths: routeProps.get('paths'),
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onSubmit: (conversationIDKey: Types.ConversationIDKey, pathToInfo: PathToInfo) => {
    const paths = Object.keys(pathToInfo)
    const titles = paths.map(p => pathToInfo[p].title)
    dispatch(
      Chat2Gen.createAttachmentsUpload({
        conversationIDKey,
        paths,
        titles,
      })
    )
    dispatch(navigateUp())
  },
  onClose: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  onClose: dispatchProps.onClose,
  onSubmit: (pathToInfo: PathToInfo) => dispatchProps._onSubmit(stateProps._conversationIDKey, pathToInfo),
  pathToInfo: stateProps.paths.reduce((map, path) => {
    const filename = FsTypes.getLocalPathName(path)
    map[path] = {
      filename,
      title: '',
      type: Constants.pathToAttachmentType(path),
    }
    return map
  }, {}),
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(GetTitles)
