// @flow
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Constants from '../../../constants/chat2'
import * as Types from '../../../constants/types/chat2'
import RenderAttachmentInput from './'
import {connect, type TypedState, type Dispatch} from '../../../util/container'
import {isWindows} from '../../../constants/platform'
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
    Object.keys(pathToInfo).forEach(path => {
      dispatch(
        Chat2Gen.createAttachmentUpload({
          conversationIDKey,
          path,
          title: pathToInfo[path].title,
        })
      )
    })
    dispatch(navigateUp())
  },
  onClose: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  onClose: dispatchProps.onClose,
  onSubmit: (pathToInfo: PathToInfo) => dispatchProps._onSubmit(stateProps._conversationIDKey, pathToInfo),
  pathToInfo: stateProps.paths.reduce((map, path) => {
    const parts = path.split(isWindows ? '\\' : '/')
    const filename = parts[parts.length - 1]
    map[path] = {
      filename,
      title: filename,
      type: Constants.pathToAttachmentType(path),
    }
    return map
  }, {}),
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(RenderAttachmentInput)
