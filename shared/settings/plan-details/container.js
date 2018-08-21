// @noflow
import logger from '../../logger'
import PlanDetails from './index'
import {connect} from 'react-redux'
import {navigateUp} from '../../actions/route-tree'
import {priceToString, planToStars} from '../../constants/plan-billing'
import {type AvailablePlan} from '../../constants/types/plan-billing'
import {type PlanLevel} from '../../constants/types/settings'
import {type RouteProps} from '../../route-tree/render-route'
import {type TypedState} from '../../constants/reducer'

type OwnProps = RouteProps<
  {
    selectedLevel: PlanLevel,
  },
  {}
>

export default connect(
  (state: TypedState, ownProps: OwnProps) => {
    const selectedLevel = ownProps.routeProps.get('selectedLevel')
    const availablePlan: ?AvailablePlan = state.planBilling.availablePlans
      ? state.planBilling.availablePlans.find(plan => plan.planLevel === selectedLevel)
      : null
    if (!availablePlan) {
      throw new Error(`Error loading plan, can't find ${selectedLevel}`)
    }

    return {
      plan: selectedLevel,
      gigabytes: availablePlan.gigabytes,
      price: priceToString(availablePlan.price_pennies),
      numStars: planToStars(selectedLevel),
      paymentOption: {
        type: 'credit-card-no-past',
        onAddCreditCard: () => logger.debug('onadd credit'), // TODO
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
      onAddCreditCard: () => logger.debug('onadd credit'), // TODO
    },
  })
)(PlanDetails)
