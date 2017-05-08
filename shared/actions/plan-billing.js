// @flow

import {call, put, select} from 'redux-saga/effects'
import {safeTakeLatest} from '../util/saga'
import * as Constants from '../constants/plan-billing'
import {apiserverGetRpcPromise, apiserverGetWithSessionRpcPromise, apiserverPostRpcPromise} from '../constants/types/flow-types'

import type {SagaGenerator} from '../constants/types/saga'
import type {TypedState} from '../constants/reducer'

function updateBilling (updateBillingArgs: Constants.UpdateBillingArgs): Constants.UpdateBilling {
  return {
    type: Constants.updateBilling,
    payload: updateBillingArgs,
  }
}

function clearBillingError (): Constants.BillingError {
  return {
    type: Constants.billingError,
    payload: undefined,
  }
}

function fetchBillingAndQuota (): Constants.FetchBillingAndQuota {
  return {
    type: Constants.fetchBillingAndQuota,
    payload: undefined,
  }
}

function fetchBillingOverview (): Constants.FetchBillingOverview {
  return {
    type: Constants.fetchBillingOverview,
    payload: undefined,
  }
}

function bootstrapData (): Constants.BootstrapData {
  return {
    type: Constants.bootstrapData,
    payload: undefined,
  }
}

function apiArgsFormatter (args: Object) {
  return Object.keys(args).map(key => {
    return {key, value: args[key]}
  })
}

function updateBillingArgsToApiArgs ({
  planId,
  cardNumber,
  nameOnCard,
  securityCode,
  cardExpMonth,
  cardExpYear,
}: Constants.UpdateBillingArgs): Object {
  return {
    plan_id: planId,
    cc_number: cardNumber.stringValue(),
    cc_name: nameOnCard.stringValue(),
    cc_cvc: securityCode.stringValue(),
    cc_exp_month: cardExpMonth.stringValue(),
    cc_exp_year: cardExpYear.stringValue(),
  }
}

function * updateBillingSaga ({payload}: Constants.UpdateBilling): SagaGenerator<any, any> {
  let planId = payload.planId
  if (planId == null) {
    const currentPlanIdSelector = ({planBilling: {plan}}: TypedState) => plan && plan.planId
    planId = ((yield select(currentPlanIdSelector)): any)
  }

  // TODO (MM) some loading indicator: true
  try {
    yield call(apiserverPostRpcPromise, {
      param: {
        endpoint: 'account/billing_update',
        args: apiArgsFormatter(updateBillingArgsToApiArgs({...payload, planId})),
      },
    })

    yield put(fetchBillingOverview())
    yield put(clearBillingError())
  } catch (e) {
    yield put({
      type: Constants.billingError,
      error: true,
      payload: {
        errorText: e.desc,
      },
    })
  }

  // TODO (MM) some loading indicator: false
}

function * fetchBillingOverviewSaga (): SagaGenerator<any, any> {
  try {
    const results: any = yield call(apiserverGetWithSessionRpcPromise, {
      param: {
        endpoint: 'account/billing_overview',
      },
    })

    const parsed = JSON.parse(results.body)

    const action: Constants.UpdateAvailablePlans = {
      type: Constants.updateAvailablePlans,
      payload: {
        availablePlans: parsed.available_plans.map(Constants.parseAvailablePlan).sort((a, b) => {
          if (a.price_pennies === b.price_pennies) return 0
          return (a.price_pennies < b.price_pennies) ? -1 : 1
        }),
      },
    }

    yield put(action)

    const billingAndQuotaAction: Constants.UpdateBillingAndQuota = {
      type: Constants.updateBillingAndQuota,
      payload: Constants.billingAndQuotaAPIToOurBillingAndQuota(parsed),
    }

    if (parsed.payment && parsed.payment.stripe_card_info) {
      const paymentInfoAction: Constants.UpdatePaymentInfo = {
        type: Constants.updatePaymentInfo,
        payload: {paymentInfo: Constants.parsePaymentInfo(parsed.payment.stripe_card_info)},
      }

      yield put(paymentInfoAction)
    }

    yield put(billingAndQuotaAction)
  } catch (e) {
    console.warn('error in fetchBillingAndQuotaSaga', e)
  }
}

function * fetchBillingAndQuotaSaga (): SagaGenerator<any, any> {
  try {
    const usernameSelector = ({config: {username}}: TypedState) => username
    const username = yield select(usernameSelector)

    const results: any = yield call(apiserverGetRpcPromise, {
      param: {
        endpoint: 'user/lookup',
        args: apiArgsFormatter(
          {username, fields: 'billing_and_quotas'}
        ),
      },
    })

    const parsed = JSON.parse(results.body)

    const action: Constants.UpdateBillingAndQuota = {
      type: Constants.updateBillingAndQuota,
      payload: Constants.billingAndQuotaAPIToOurBillingAndQuota(
        parsed.them.billing_and_quotas,
      ),
    }

    yield put(action)
  } catch (e) {
    console.warn('error in fetchBillingAndQuotaSaga', e)
  }
}

function * bootstrapDataSaga (): SagaGenerator<any, any> {
  const billingStateSelector = ({planBilling}: TypedState) => planBilling

  const planBilling: Constants.State = ((yield select(billingStateSelector)): any)

  if (planBilling.availablePlans == null || planBilling.usage == null || planBilling.plan == null) {
    yield put(fetchBillingOverview())
  }
}

function * billingSaga (): SagaGenerator<any, any> {
  yield safeTakeLatest(Constants.updateBilling, updateBillingSaga)
  yield safeTakeLatest(Constants.fetchBillingAndQuota, fetchBillingAndQuotaSaga)
  yield safeTakeLatest(Constants.fetchBillingOverview, fetchBillingOverviewSaga)
  yield safeTakeLatest(Constants.bootstrapData, bootstrapDataSaga)
}

export {
  bootstrapData,
  clearBillingError,
  fetchBillingAndQuota,
  fetchBillingOverview,
  updateBilling,
}

export default billingSaga
