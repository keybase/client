// import logger from '../logger'
import * as Saga from '../util/saga'
// import * as Constants from '../constants/plan-billing'
// import * as Types from '../constants/types/plan-billing'
// import * as RPCTypes from '../constants/types/rpc-gen'
// import {type TypedState} from '../constants/reducer'

// function updateBilling(updateBillingArgs: Types.UpdateBillingArgs): Types.UpdateBilling {
// return {
// payload: updateBillingArgs,
// type: Constants.updateBilling,
// }
// }

// function clearBillingError(): Types.BillingError {
// return {
// payload: undefined,
// type: Constants.billingError,
// }
// }

// function fetchBillingAndQuota(): Types.FetchBillingAndQuota {
// return {
// payload: undefined,
// type: Constants.fetchBillingAndQuota,
// }
// }

// function fetchBillingOverview(): Types.FetchBillingOverview {
// return {
// payload: undefined,
// type: Constants.fetchBillingOverview,
// }
// }

// function bootstrapData(): Types.BootstrapData {
// return {
// payload: undefined,
// type: Constants.bootstrapData,
// }
// }

// function apiArgsFormatter(args: Object) {
// return Object.keys(args).map(key => {
// return {key, value: args[key]}
// })
// }

// function updateBillingArgsToApiArgs({
// planId,
// cardNumber,
// nameOnCard,
// securityCode,
// cardExpMonth,
// cardExpYear,
// }: Types.UpdateBillingArgs): Object {
// return {
// cc_cvc: securityCode.stringValue(),
// cc_exp_month: cardExpMonth.stringValue(),
// cc_exp_year: cardExpYear.stringValue(),
// cc_name: nameOnCard.stringValue(),
// cc_number: cardNumber.stringValue(),
// plan_id: planId,
// }
// }

// function* updateBillingSaga({payload}: Types.UpdateBilling): Saga.SagaGenerator<any, any> {
// let planId = payload.planId
// if (planId == null) {
// const currentPlanIdSelector = ({planBilling: {plan}}: TypedState) => plan && plan.planId
// const state = yield* Saga.selectState()
// planId = currentPlanIdSelector(state)
// }

// // TODO (MM) some loading indicator: true
// try {
// yield Saga.callUntyped(RPCTypes.apiserverPostRpcPromise, {
// args: apiArgsFormatter(updateBillingArgsToApiArgs({...payload, planId})),
// endpoint: 'account/billing_update',
// })

// yield Saga.put(fetchBillingOverview())
// yield Saga.put(clearBillingError())
// } catch (e) {
// yield Saga.put({
// error: true,
// payload: {
// errorText: e.desc,
// },
// type: Constants.billingError,
// })
// }

// // TODO (MM) some loading indicator: false
// }

// function* fetchBillingOverviewSaga(): Saga.SagaGenerator<any, any> {
// try {
// const results: any = yield* Saga.callPromise(RPCTypes.apiserverGetWithSessionRpcPromise, {
// endpoint: 'account/billing_overview',
// })

// const parsed = JSON.parse(results.body)

// const action: Types.UpdateAvailablePlans = {
// payload: {
// availablePlans: parsed.available_plans.map(Constants.parseAvailablePlan).sort((a, b) => {
// if (a.price_pennies === b.price_pennies) return 0
// return a.price_pennies < b.price_pennies ? -1 : 1
// }),
// },
// type: Constants.updateAvailablePlans,
// }

// yield Saga.put(action)

// const billingAndQuotaAction: Types.UpdateBillingAndQuota = {
// payload: Constants.billingAndQuotaAPIToOurBillingAndQuota(parsed),
// type: Constants.updateBillingAndQuota,
// }

// if (parsed.payment && parsed.payment.stripe_card_info) {
// const paymentInfoAction: Types.UpdatePaymentInfo = {
// payload: {paymentInfo: Constants.parsePaymentInfo(parsed.payment.stripe_card_info)},
// type: Constants.updatePaymentInfo,
// }

// yield Saga.put(paymentInfoAction)
// }

// yield Saga.put(billingAndQuotaAction)
// } catch (e) {
// logger.warn('error in fetchBillingAndQuotaSaga', e)
// }
// }

// function* fetchBillingAndQuotaSaga(): Saga.SagaGenerator<any, any> {
// try {
// const state = yield* Saga.selectState()
// const username = state.config.username

// const results: any = yield* Saga.callPromise(RPCTypes.apiserverGetRpcPromise, {
// args: apiArgsFormatter({fields: 'billing_and_quotas', username}),
// endpoint: 'user/lookup',
// })

// const parsed = JSON.parse(results.body)

// const action: Types.UpdateBillingAndQuota = {
// payload: Constants.billingAndQuotaAPIToOurBillingAndQuota(parsed.them.billing_and_quotas),
// type: Constants.updateBillingAndQuota,
// }

// yield Saga.put(action)
// } catch (e) {
// logger.warn('error in fetchBillingAndQuotaSaga', e)
// }
// }

// function* bootstrapDataSaga(): Saga.SagaGenerator<any, any> {
// const billingStateSelector = ({planBilling}: TypedState) => planBilling

// const state = yield* Saga.selectState()
// const planBilling: Types.State = billingStateSelector(state)
// if (planBilling.availablePlans == null || planBilling.usage == null || planBilling.plan == null) {
// yield Saga.put(fetchBillingOverview())
// }
// }

function* billingSaga(): Saga.SagaGenerator<any, any> {
  // this isn't used
  // yield Saga.safeTakeEvery(Constants.updateBilling, updateBillingSaga)
  // yield Saga.safeTakeEvery(Constants.fetchBillingAndQuota, fetchBillingAndQuotaSaga)
  // yield Saga.safeTakeEvery(Constants.fetchBillingOverview, fetchBillingOverviewSaga)
  // yield Saga.safeTakeEvery(Constants.bootstrapData, bootstrapDataSaga)
}

// export {bootstrapData, clearBillingError, fetchBillingAndQuota, fetchBillingOverview, updateBilling}

export default billingSaga
