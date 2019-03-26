// @flow
import * as SettingsGen from '../../actions/settings-gen'
import DeleteConfirm, {type Props} from '.'
import React, {Component} from 'react'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {HOCTimers, type PropsWithTimer} from '../../common-adapters'
import {compose, connect} from '../../util/container'

type OwnProps = {||}
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

const mapStateToProps = state => {
  if (!state.config.username) {
    throw new Error('No current username for delete confirm container')
  }

  return {
    allowDeleteForever: state.settings.allowDeleteAccount,
    username: state.config.username,
  }
}

const mapDispatchToProps = dispatch => ({
  onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
  onDeleteForever: () => dispatch(SettingsGen.createDeleteAccountForever()),
  setAllowDeleteAccount: allow => dispatch(SettingsGen.createSetAllowDeleteAccount({allow})),
})

export default compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d})
  ),
  HOCTimers
)(DeleteConfirmContainer)
