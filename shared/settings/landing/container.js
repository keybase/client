// @flow
import {connect} from 'react-redux'
import Bootstrapable from '../../util/bootstrapable'

import {routeAppend} from '../../actions/router'
import * as actions from '../../actions/plan-billing'
import Landing from './index'

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
          onUpgrade: () => console.log('todo'),
          onDowngrade: () => console.log('todo'),
          onInfo: () => console.log('todo'),
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
      },
    }
  }
)(Bootstrapable(Landing))
