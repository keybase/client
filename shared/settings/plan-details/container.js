// @flow
import PlanDetails from './index'
import React, {Component} from 'react'
import {connect} from 'react-redux'
import {navigateUp} from '../../actions/router'
import {priceToString, planToStars} from '../../constants/plan-billing'

import type {AvailablePlan} from '../../constants/plan-billing'
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
    const availablePlan: ?AvailablePlan = state.planBilling.availablePlans
      ? state.planBilling.availablePlans.find(plan => plan.planLevel === ownProps.selectedLevel)
      : null
    if (!availablePlan) {
      throw new Error(`Error loading plan, can't find ${ownProps.selectedLevel}`)
    }

    return {
      plan: ownProps.selectedLevel,
      gigabytes: availablePlan.gigabytes,
      price: priceToString(availablePlan.price_pennies),
      numStars: planToStars(ownProps.selectedLevel),
      paymentOption: {
        type: 'credit-card-no-past',
        onAddCreditCard: () => console.log('onadd credit'), // TODO
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
      onAddCreditCard: () => console.log('onadd credit'), // TODO
    },
  }),
)(PlanDetailsContainer)

