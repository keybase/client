// @flow
import React, {Component} from 'react'
import PlanDetails from './index'
import {connect} from 'react-redux'
import {navigateUp} from '../../actions/router'
// import {onChangeNewPassphrase, onChangeNewPassphraseConfirm, onChangeShowPassphrase, onSubmitNewPassphrase, onUpdatePGPSettings} from '../../actions/settings'

import type {PlanLevel} from '../../constants/settings'
import type {Props} from './index'
import type {TypedState} from '../../constants/reducer'

class PlanDetailsContainer extends Component<void, Props, void> {
  static parseRoute (currentPath) {
    return {
      componentAtTop: {
        title: 'Change Plan',
        props: {
          selectedLevel: currentPath.get('selectedLevel'),
        },
      },
    }
  }

  render () {
    return <PlanDetails {...this.props} />
  }
}

type OwnProps = {
  selectedLevel: PlanLevel,
}

export default connect(
  (state: TypedState, ownProps: OwnProps) => {
    return {
      plan: ownProps.selectedLevel,
      gigabytes: 999,
      price: '$999/month',
      numStars: 1, // TODO
      paymentOption: {
        type: 'credit-card-no-past',
        onAddCreditCard: () => {}, // to make flow happy
      },
    }
  },
  (dispatch: any, ownProps: {}) => ({
    onBack: () => dispatch(navigateUp()),
  }),
  (stateProps, dispatchProps) => ({
    ...stateProps,
    ...dispatchProps,
    paymentOption: {
      ...stateProps.paymentOption,
      onAddCreditCard: () => console.log('onadd credit'),
    },
  }),
)(PlanDetailsContainer)

