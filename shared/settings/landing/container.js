// @flow
import * as actions from '../../actions/plan-billing'
import Bootstrapable from '../../util/bootstrapable'
import Landing from './index'
import {comparePlans} from '../../constants/settings'
import {connect} from 'react-redux'
import {routeAppend} from '../../actions/router'

import type {TypedState} from '../../constants/reducer'

type OwnProps = {}

export default connect(
  (state: TypedState, ownProps: OwnProps) => {
    const {planBilling: {availablePlans, usage, plan, paymentInfo}} = state
    if (!availablePlans || !usage || !plan) {
      return {
        bootstrapDone: false,
      }
    }

    const freeSpaceGB = plan.gigabytes - usage.gigabytes
    const freeSpacePercentage = freeSpaceGB / plan.gigabytes

    return {
      bootstrapDone: true,
      originalProps: {
        account: {
          email: '',
          isVerified: false,
          onChangeEmail: () => console.log('todo'),
        },
        plan: {
          selectedLevel: plan.planLevel,
          freeSpace: freeSpaceGB + 'GB',
          freeSpacePercentage,
          lowSpaceWarning: false,
          paymentInfo,
          onChangePaymentInfo: () => console.log('todo'),
        },
      },
    }
  },
  (dispatch: (a: any) => void, ownProps: OwnProps) => ({
    onBootstrap: () => { dispatch(actions.bootstrapData()) },
    onChangePassphrase: () => dispatch(routeAppend('changePassphrase')),
    onInfo: (selectedLevel, comparison) => dispatch(routeAppend({path: 'changePlan', selectedLevel, comparison})),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    if (stateProps.bootstrapDone === false) {
      return {
        ...stateProps,
        onBootstrap: dispatchProps.onBootstrap,
      }
    }

    return {
      ...stateProps,
      originalProps: {
        ...stateProps.originalProps,
        account: {
          ...stateProps.originalProps.account,
          onChangePassphrase: dispatchProps.onChangePassphrase,
        },
        plan: {
          ...stateProps.originalProps.plan,
          onInfo: (selectedLevel) => {
            // $ForceType
            const comparison = comparePlans(stateProps.originalProps.plan.selectedLevel, selectedLevel)
            dispatchProps.onInfo(selectedLevel, comparison)
          },
        },
      },
    }
  }
)(Bootstrapable(Landing))
