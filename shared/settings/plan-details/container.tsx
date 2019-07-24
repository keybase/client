import logger from '../../logger'
import PlanDetails from '.'
import {connect} from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {priceToString, planToStars} from '../../constants/plan-billing'
import {PlanLevel} from '../../constants/types/settings'
import {RouteProps} from '../../route-tree/render-route'
import {TypedState} from '../../constants/reducer'

type OwnProps = RouteProps<{selectedLevel: PlanLevel}>

export default connect(
  (_: TypedState, ownProps: OwnProps) => {
    const selectedLevel = ownProps.routeProps.get('selectedLevel')
    const availablePlan = null // AvailablePlan | null = state.planBilling.availablePlans
    // ? state.planBilling.availablePlans.find(plan => plan.planLevel === selectedLevel)
    // : null
    if (!availablePlan) {
      throw new Error(`Error loading plan, can't find ${selectedLevel}`)
    }

    return {
      // @ts-ignore
      gigabytes: availablePlan.gigabytes,
      numStars: planToStars(selectedLevel),
      paymentOption: {
        onAddCreditCard: () => logger.debug('onadd credit'), // TODO
        type: 'credit-card-no-past',
      },
      plan: selectedLevel,
      // @ts-ignore
      price: priceToString(availablePlan.price_pennies),
    }
  },
  (dispatch: any) => ({
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
  // @ts-ignore codemod-issue
)(PlanDetails)
