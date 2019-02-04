// @flow
import logger from '../../logger'
import PlanDetails from '.'
import {connect} from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
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

export default connect<OwnProps, _, _, _, _>(
  (state: TypedState, ownProps: OwnProps) => {
    const selectedLevel = ownProps.routeProps.get('selectedLevel')
    // $FlowIssue
    const availablePlan: ?AvailablePlan = state.planBilling.availablePlans
      ? state.planBilling.availablePlans.find(plan => plan.planLevel === selectedLevel)
      : null
    if (!availablePlan) {
      throw new Error(`Error loading plan, can't find ${selectedLevel}`)
    }

    return {
      gigabytes: availablePlan.gigabytes,
      numStars: planToStars(selectedLevel),
      paymentOption: {
        onAddCreditCard: () => logger.debug('onadd credit'), // TODO
        type: 'credit-card-no-past',
      },
      plan: selectedLevel,
      price: priceToString(availablePlan.price_pennies),
    }
  },
  (dispatch: any, ownProps: {}) => ({
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
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
