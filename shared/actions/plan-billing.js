// @noflow
import logger from '../logger'
import * as Saga from '../util/saga'
import * as Constants from '../constants/plan-billing'
import * as Types from '../constants/types/plan-billing'
import * as RPCTypes from '../constants/types/rpc-gen'
import {type TypedState} from '../constants/reducer'

function updateBilling(updateBillingArgs: Types.UpdateBillingArgs): Types.UpdateBilling {
  return {
    type: Constants.updateBilling,
    payload: updateBillingArgs,
  }
}

function clearBillingError(): Types.BillingError {
  return {
    type: Constants.billingError,
    payload: undefined,
  }
}

function fetchBillingAndQuota(): Types.FetchBillingAndQuota {
  return {
    type: Constants.fetchBillingAndQuota,
    payload: undefined,
  }
}

function fetchBillingOverview(): Types.FetchBillingOverview {
  return {
    type: Constants.fetchBillingOverview,
    payload: undefined,
  }
}

function bootstrapData(): Types.BootstrapData {
  return {
    type: Constants.bootstrapData,
    payload: undefined,
  }
}

function apiArgsFormatter(args: Object) {
  return Object.keys(args).map(key => {
    return {key, value: args[key]}
  })
}

function updateBillingArgsToApiArgs({
  planId,
  cardNumber,
  nameOnCard,
  securityCode,
  cardExpMonth,
  cardExpYear,
}: Types.UpdateBillingArgs): Object {
  return {
    plan_id: planId,
    cc_number: cardNumber.stringValue(),
    cc_name: nameOnCard.stringValue(),
    cc_cvc: securityCode.stringValue(),
    cc_exp_month: cardExpMonth.stringValue(),
    cc_exp_year: cardExpYear.stringValue(),
  }
}

function* updateBillingSaga({payload}: Types.UpdateBilling): Saga.SagaGenerator<any, any> {
  let planId = payload.planId
  if (planId == null) {
    const currentPlanIdSelector = ({planBilling: {plan}}: TypedState) => plan && plan.planId
    planId = (yield Saga.select(currentPlanIdSelector): any)
  }

  // TODO (MM) some loading indicator: true
  try {
    yield Saga.call(RPCTypes.apiserverPostRpcPromise, {
      endpoint: 'account/billing_update',
      args: apiArgsFormatter(updateBillingArgsToApiArgs({...payload, planId})),
    })

    yield Saga.put(fetchBillingOverview())
    yield Saga.put(clearBillingError())
  } catch (e) {
    yield Saga.put({
      type: Constants.billingError,
      error: true,
      payload: {
        errorText: e.desc,
      },
    })
  }

  // TODO (MM) some loading indicator: false
}

function* fetchBillingOverviewSaga(): Saga.SagaGenerator<any, any> {
  try {
    const results: any = yield Saga.call(RPCTypes.apiserverGetWithSessionRpcPromise, {
      endpoint: 'account/billing_overview',
    })

    const parsed = JSON.parse(results.body)

    const action: Types.UpdateAvailablePlans = {
      type: Constants.updateAvailablePlans,
      payload: {
        availablePlans: parsed.available_plans.map(Constants.parseAvailablePlan).sort((a, b) => {
          if (a.price_pennies === b.price_pennies) return 0
          return a.price_pennies < b.price_pennies ? -1 : 1
        }),
      },
    }

    yield Saga.put(action)

    const billingAndQuotaAction: Types.UpdateBillingAndQuota = {
      type: Constants.updateBillingAndQuota,
      payload: Constants.billingAndQuotaAPIToOurBillingAndQuota(parsed),
    }

    if (parsed.payment && parsed.payment.stripe_card_info) {
      const paymentInfoAction: Types.UpdatePaymentInfo = {
        type: Constants.updatePaymentInfo,
        payload: {paymentInfo: Constants.parsePaymentInfo(parsed.payment.stripe_card_info)},
      }

      yield Saga.put(paymentInfoAction)
    }

    yield Saga.put(billingAndQuotaAction)
  } catch (e) {
    logger.warn('error in fetchBillingAndQuotaSaga', e)
  }
}

function* fetchBillingAndQuotaSaga(): Saga.SagaGenerator<any, any> {
  try {
    const state: TypedState = yield Saga.select()
    const username = state.config.username

    const results: any = yield Saga.call(RPCTypes.apiserverGetRpcPromise, {
      endpoint: 'user/lookup',
      args: apiArgsFormatter({username, fields: 'billing_and_quotas'}),
    })

    const parsed = JSON.parse(results.body)

    const action: Types.UpdateBillingAndQuota = {
      type: Constants.updateBillingAndQuota,
      payload: Constants.billingAndQuotaAPIToOurBillingAndQuota(parsed.them.billing_and_quotas),
    }

    yield Saga.put(action)
  } catch (e) {
    logger.warn('error in fetchBillingAndQuotaSaga', e)
  }
}

function* bootstrapDataSaga(): Saga.SagaGenerator<any, any> {
  const billingStateSelector = ({planBilling}: TypedState) => planBilling

  const planBilling: Types.State = (yield Saga.select(billingStateSelector): any)
  if (planBilling.availablePlans == null || planBilling.usage == null || planBilling.plan == null) {
    yield Saga.put(fetchBillingOverview())
  }
}

function* billingSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEvery(Constants.updateBilling, updateBillingSaga)
  yield Saga.safeTakeEvery(Constants.fetchBillingAndQuota, fetchBillingAndQuotaSaga)
  yield Saga.safeTakeEvery(Constants.fetchBillingOverview, fetchBillingOverviewSaga)
  yield Saga.safeTakeEvery(Constants.bootstrapData, bootstrapDataSaga)
}

export {bootstrapData, clearBillingError, fetchBillingAndQuota, fetchBillingOverview, updateBilling}

export default billingSaga
