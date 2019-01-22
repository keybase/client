// @flow
import * as I from 'immutable'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {namedConnect} from '../../util/container'
import SendAttachmentToChat from '.'

type OwnProps = {
  routePath: I.List<string>,
}

const mapStateToProps = state => ({
  _sendAttachmentToChat: state.fs.sendAttachmentToChat,
})

const mapDispatchToProps = (dispatch, ownProps) => ({
  onCancel: () =>
    dispatch(
      RouteTreeGen.createPutActionIfOnPath({
        expectedPath: ownProps.routePath,
        otherAction: RouteTreeGen.createNavigateUp(),
      })
    ),
})

const mergeProps = (stateProps, dispatchProps, ownPropps) => ({
  onCancel: dispatchProps.onCancel,
  path: stateProps._sendAttachmentToChat.path,
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'SendAttachmentToChat'
)(SendAttachmentToChat)
