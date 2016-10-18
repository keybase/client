// @flow
import React, {Component} from 'react'
import PlanDetails from './index'
import {connect} from 'react-redux'
import {navigateUp} from '../../actions/router'
// import {onChangeNewPassphrase, onChangeNewPassphraseConfirm, onChangeShowPassphrase, onSubmitNewPassphrase, onUpdatePGPSettings} from '../../actions/settings'

import type {Props} from './index'
import type {TypedState} from '../../constants/reducer'

class PlanDetailsContainer extends Component<void, Props, void> {
  static parseRoute () {
    return {
      componentAtTop: {title: 'Change Plan'},
    }
  }

  render () {
    return <PlanDetails {...this.props} />
  }
}

export default connect(
  (state: TypedState, ownProps: {}) => ({
    // newPassphrase: state.settings.passphrase.newPassphrase.stringValue(),
  }),
  (dispatch: any, ownProps: {}) => ({
    onBack: () => dispatch(navigateUp()),
  })
)(PlanDetailsContainer)

