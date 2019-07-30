import * as SettingsGen from '../../actions/settings-gen'
import DeleteConfirm, {Props} from '.'
import React, {Component} from 'react'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {HOCTimers, PropsWithTimer} from '../../common-adapters'
import * as Container from '../../util/container'

type OwnProps = {}

class DeleteConfirmContainer extends Component<PropsWithTimer<Props>> {
  componentDidMount() {
    this.props.setAllowDeleteAccount(false)
    this.props.setTimeout(() => {
      this.props.setAllowDeleteAccount(true)
    }, 2000)
  }

  componentWillUnmount() {
    this.props.setAllowDeleteAccount(false)
  }

  render() {
    return <DeleteConfirm {...this.props} />
  }
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
)(HOCTimers(DeleteConfirmContainer))
