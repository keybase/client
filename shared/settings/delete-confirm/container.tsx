import * as Kb from '../../common-adapters'
import * as SettingsGen from '../../actions/settings-gen'
import DeleteConfirm, {Props} from '.'
import React from 'react'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'

type OwnProps = {}

const DeleteConfirmContainer = (props: Props) => {
  const enableDeleteLater = Kb.useTimeout(() => props.setAllowDeleteAccount(true), 2000)
  React.useEffect(() => {
    props.setAllowDeleteAccount(false)
    enableDeleteLater()
  }, [])
  return <DeleteConfirm {...props} />
}

export default Container.connect(
  state => {
    if (!state.config.username) {
      throw new Error('No current username for delete confirm container')
    }

    return {
      allowDeleteForever: state.settings.allowDeleteAccount,
      username: state.config.username,
    }
  },
  dispatch => ({
    onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
    onDeleteForever: () => dispatch(SettingsGen.createDeleteAccountForever()),
    setAllowDeleteAccount: allow => dispatch(SettingsGen.createSetAllowDeleteAccount({allow})),
  }),

  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(DeleteConfirmContainer)
