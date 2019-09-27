import * as SettingsGen from '../../actions/settings-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import DeleteConfirm from '.'

type OwnProps = {}

export default Container.connect(
  state => {
    if (!state.config.username) {
      throw new Error('No current username for delete confirm container')
    }

    return {
      username: state.config.username,
    }
  },
  dispatch => ({
    onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
    onDeleteForever: () => dispatch(SettingsGen.createDeleteAccountForever()),
  }),

  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(DeleteConfirm)
