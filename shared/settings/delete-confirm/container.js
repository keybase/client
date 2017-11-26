// @flow
import * as SettingsGen from '../../actions/settings-gen'
import DeleteConfirm, {type Props} from '.'
import React, {Component} from 'react'
import {HOCTimers} from '../../common-adapters'
import {navigateUp} from '../../actions/route-tree'
import {type TimerProps} from '../../common-adapters/hoc-timers'
import {connect, type TypedState} from '../../util/container'

class DeleteConfirmContainer extends Component<Props & TimerProps> {
  componentWillMount() {
    this.props.setAllowDeleteAccount(false)
  }

  componentDidMount() {
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

const mapStateToProps = (state: TypedState) => {
  if (!state.config.username) {
    throw new Error('No current username for delete confirm container')
  }

  return {
    allowDeleteForever: state.settings.allowDeleteAccount,
    username: state.config.username,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onCancel: () => dispatch(navigateUp()),
  onDeleteForever: () => dispatch(SettingsGen.createDeleteAccountForever()),
  setAllowDeleteAccount: allow => dispatch(SettingsGen.createSetAllowDeleteAccount({allow})),
})

export default connect(mapStateToProps, mapDispatchToProps)(HOCTimers(DeleteConfirmContainer))
