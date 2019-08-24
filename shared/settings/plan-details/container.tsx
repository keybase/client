import logger from '../../logger'
import PlanDetails from '.'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {priceToString, planToStars} from '../../constants/plan-billing'
import {PlanLevel} from '../../constants/types/settings'

type OwnProps = Container.RouteProps<{selectedLevel: PlanLevel}>

export default Container.connect(
  (_, ownProps: OwnProps) => {
    const selectedLevel = Container.getRouteProps(ownProps, 'selectedLevel', '')
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
  dispatch => ({
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    ...stateProps,
    ...dispatchProps,
    paymentOption: {
      ...stateProps.paymentOption,
      onAddCreditCard: () => logger.debug('onadd credit'), // TODO
    },
  })
  // @ts-ignore codemod-issue
)(PlanDetails)
