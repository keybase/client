// @flow
import React, {Component} from 'react'
import {TypedConnector} from '../../util/typed-connect'
import {navigateUp} from '../../actions/route-tree'
import {HOCTimers} from '../../common-adapters'
import DeleteConfirm from './index'
import {setAllowDeleteAccount, deleteAccountForever} from '../../actions/settings'

import type {TypedDispatch} from '../../constants/types/flux'
import type {TypedState} from '../../constants/reducer'
import type {TimerProps} from '../../common-adapters/hoc-timers'
import type {Props} from './index'

class DeleteConfirmContainer extends Component<void, Props & TimerProps, void> {
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

const connector: TypedConnector<TypedState, TypedDispatch<{}>, {}, Props> = new TypedConnector()

export default connector.connect((state, dispatch, ownProps) => {
  if (!state.config.username) {
    throw new Error('No current username for delete confirm container')
  }

  return {
    username: state.config.username,
    allowDeleteForever: state.settings.allowDeleteAccount,
    setAllowDeleteAccount: allow => {
      dispatch(setAllowDeleteAccount(allow))
    },
    onCancel: () => {
      dispatch(navigateUp())
    },
    onDeleteForever: () => {
      dispatch(deleteAccountForever())
    },
  }
})(HOCTimers(DeleteConfirmContainer))
