// @flow
import * as actions from '../../actions/settings'
import Bootstrapable from '../../util/bootstrapable'
import Landing from './index'
import {connect} from 'react-redux'
import {routeAppend} from '../../actions/router'

import type {TypedState} from '../../constants/reducer'

type OwnProps = {}

export default connect(
  (state: TypedState, ownProps: OwnProps) => {
    const {planBilling: {availablePlans, usage, plan, paymentInfo}, settings} = state

    let accountProps
    if (settings.emails && settings.emails.length > 0) {
      let primary = settings.emails[0]
      if (primary) {
        accountProps = {
          email: primary.email,
          isVerified: primary.isVerified,
          onChangeEmail: () => console.log('todo'),
          onChangePassphrase: () => console.log('todo'),
        }
      }
    }

    let planProps
    if (plan && usage) {
      const freeSpaceGB = plan.gigabytes - usage.gigabytes
      const freeSpacePercentage = freeSpaceGB / plan.gigabytes
      planProps = {
        onUpgrade: () => console.log('todo'),
        onDowngrade: () => console.log('todo'),
        onInfo: () => console.log('todo'),
        selectedLevel: plan.planLevel,
        freeSpace: freeSpaceGB + 'GB',
        freeSpacePercentage,
        lowSpaceWarning: false,
        paymentInfo,
        onChangePaymentInfo: () => console.log('todo'),
      }
    }

    // When enabling planProps, we should check both for bootstrapDone:
    // let bootstrapDone = accountProps && planProps
    let bootstrapDone = !!accountProps

    return {
      bootstrapDone: bootstrapDone,
      originalProps: {
        account: accountProps,
        plan: planProps,
        plans: availablePlans,
      },
    }
  },
  (dispatch: (a: any) => void, ownProps: OwnProps) => ({
    onBootstrap: () => { dispatch(actions.loadSettings()) },
    onChangePassphrase: () => dispatch(routeAppend('changePassphrase')),
    onInfo: (selectedLevel) => dispatch(routeAppend({path: 'changePlan', selectedLevel})),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    if (!stateProps.bootstrapDone) {
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
            dispatchProps.onInfo(selectedLevel)
          },
        },
      },
    }
  }
)(Bootstrapable(Landing))
