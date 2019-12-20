import * as SettingsGen from '../../actions/settings-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import DeleteConfirm from '.'

type OwnProps = {}

export default Container.connect(
  state => ({
    username: state.config.username,
  }),
  dispatch => ({
    _onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
    _onDeleteForever: () => dispatch(SettingsGen.createDeleteAccountForever()),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    ...ownProps,
    ...stateProps,
    onCancel: dispatchProps._onCancel,
    onDeleteForever: () => stateProps.username && dispatchProps._onDeleteForever(),
  })
)(DeleteConfirm)
