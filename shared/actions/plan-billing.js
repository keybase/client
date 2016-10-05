// @flow

import {call, put, select} from 'redux-saga/effects'
import {takeLatest, delay} from 'redux-saga'
import * as Constants from '../constants/plan-billing'
import {apiserverGetRpcPromise, apiserverPostRpcPromise} from '../constants/types/flow-types'

import type {UpdateBillingArgs, UpdateBilling, FetchBillingAndQuota, FetchBillingOverview, UpdateBillingAndQuota, UpdateAvailablePlans, BillingState, BootstrapData, UpdatePaymentInfo, BillingError} from '../constants/plan-billing'
import type {SagaGenerator} from '../constants/types/saga'
import type {TypedState} from '../constants/reducer'
import type {BootStatus} from '../constants/config'

function updateBilling (updateBillingArgs: UpdateBillingArgs): UpdateBilling {
  return {
    type: Constants.updateBilling,
    payload: updateBillingArgs,
  }
}

function clearBillingError (): BillingError {
  return {
    type: Constants.billingError,
    payload: undefined,
  }
}

function fetchBillingAndQuota (): FetchBillingAndQuota {
  return {
    type: Constants.fetchBillingAndQuota,
    payload: undefined,
  }
}

function fetchBillingOverview (): FetchBillingOverview {
  return {
    type: Constants.fetchBillingOverview,
    payload: undefined,
  }
}

function bootstrapData (): BootstrapData {
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
}: UpdateBillingArgs): Object {
  return {
    plan_id: planId,
    cc_number: cardNumber.stringValue(),
    cc_name: nameOnCard.stringValue(),
    cc_cvc: securityCode.stringValue(),
    cc_exp_month: cardExpMonth.stringValue(),
    cc_exp_year: cardExpYear.stringValue(),
  }
}

function * updateBillingSaga ({payload}: UpdateBilling): SagaGenerator<any, any> {
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
    const results: any = yield call(apiserverGetRpcPromise, {
      param: {
        endpoint: 'account/billing_overview',
      },
    })

    const parsed = JSON.parse(results.body)

    const action: UpdateAvailablePlans = {
      type: Constants.updateAvailablePlans,
      payload: {
        availablePlans: parsed.available_plans.map(Constants.parseAvailablePlan),
      },
    }

    yield put(action)

    const billingAndQuotaAction: UpdateBillingAndQuota = {
      type: Constants.updateBillingAndQuota,
      payload: Constants.billingAndQuotaAPIToOurBillingAndQuota(parsed),
    }

    if (parsed.payment && parsed.payment.stripe_card_info) {
      const paymentInfoAction: UpdatePaymentInfo = {
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

    const action: UpdateBillingAndQuota = {
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
  const overallBootstrappedSelector = ({config: {bootStatus}}: TypedState) => bootStatus
  const loggedInSelector = ({config: {loggedIn}}: TypedState) => loggedIn

  let bootstrapStatus: BootStatus = ((yield select(overallBootstrappedSelector)): any)
  let loggedIn: boolean = ((yield select(loggedInSelector)): any)

  while (bootstrapStatus !== 'bootStatusBootstrapped' || !loggedIn) {
    yield call(delay, 500)
    bootstrapStatus = ((yield select(overallBootstrappedSelector)): any)
    loggedIn = ((yield select(loggedInSelector)): any)
  }

  const planBilling: BillingState = ((yield select(billingStateSelector)): any)

  if (planBilling.availablePlans == null || planBilling.usage == null || planBilling.plan == null) {
    yield put(fetchBillingOverview())
  }
}

function * billingSaga (): SagaGenerator<any, any> {
  yield [
    takeLatest(Constants.updateBilling, updateBillingSaga),
    takeLatest(Constants.fetchBillingAndQuota, fetchBillingAndQuotaSaga),
    takeLatest(Constants.fetchBillingOverview, fetchBillingOverviewSaga),
    takeLatest(Constants.bootstrapData, bootstrapDataSaga),
  ]
}

export {
  bootstrapData,
  clearBillingError,
  fetchBillingAndQuota,
  fetchBillingOverview,
  updateBilling,
}

export default billingSaga
