// @flow
import React, {Component} from 'react'
import {TypedConnector} from '../../util/typed-connect'
import {navigateUp} from '../../actions/router'
import DeleteConfirm from './index'
import {deleteAccountForever} from '../../actions/settings'

import type {TypedDispatch} from '../../constants/types/flux'
import type {TypedState} from '../../constants/reducer'
import type {Props} from './index'

class DeleteConfirmContainer extends Component<void, Props, void> {
  static parseRoute () {
    return {componentAtTop: {title: ''}}
  }

  render () {
    return <DeleteConfirm {...this.props} />
  }
}

const connector: TypedConnector<TypedState, TypedDispatch<{}>, {}, Props> = new TypedConnector()

export default connector.connect(
  (state, dispatch, ownProps) => {
    if (!state.config.username) {
      throw new Error('No current username for delete confirm container')
    }

    return {
      username: state.config.username,
      onCancel: () => { dispatch(navigateUp()) },
      onDeleteForever: () => { dispatch(deleteAccountForever()) },
    }
  }
)(DeleteConfirmContainer)
