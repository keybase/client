// @flow
import {connect} from 'react-redux'
import Bootstrapable from '../../util/bootstrapable'

import * as actions from '../../actions/settings'
import Landing from './index'

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

    return {
      bootstrapDone: accountProps && planProps,
      originalProps: {
        account: accountProps,
        plan: planProps,
      },
    }
  },
  (dispatch: (a: any) => void, ownProps: OwnProps) => ({
    onBootstrap: () => { dispatch(actions.loadSettings()) },
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
    }
  }
)(Bootstrapable(Landing))
