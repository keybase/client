// @flow
import HiddenString from '../../util/hidden-string'
import type {PlanLevel} from '../settings'
import type {TypedAction, NoErrorTypedAction} from './flux'

export type UpdateBillingArgs = {
  planId?: string,
  cardNumber: HiddenString,
  nameOnCard: HiddenString,
  securityCode: HiddenString,
  cardExpMonth: HiddenString,
  cardExpYear: HiddenString,
}

export type PlanInfoAPI = {
  plan_id: string,
  plan_name: 'BASIC' | 'GOLD' | 'FRIEND',
  price_pennies: number,
  gigabytes: number,
  num_groups: number,
  folders_with_writes: number,
  billing_status: number,
  test_mode: ?any,
}

export type UsageInfoAPI = {
  gigabytes: number,
  num_groups: number,
  folders_with_writes: number,
}

export type BillingAndQuotaAPI = {
  plan: PlanInfoAPI,
  usage: UsageInfoAPI,
}

export type PlanInfo = {
  planLevel: PlanLevel,
  planId: string,
  gigabytes: number,
}

export type UsageInfo = {
  gigabytes: number,
}

export type BillingAndQuota = {
  plan: PlanInfo,
  usage: UsageInfo,
}

export type AvailablePlan = {
  planLevel: PlanLevel,
  planId: string,
  gigabytes: number,
  price_pennies: number,
}

export type PaymentInfo = {
  name: string,
  last4Digits: string,
  isBroken: boolean,
}

export type PaymentInfoAPI = {
  last4: string,
  name: string,
  cvc_check: 'pass' | any,
}

export type AvailablePlans = Array<AvailablePlan>

export type AvailablePlanAPI = {
  plan_name: string,
  plan_id: string,
  price_pennies: number,
  gigabytes: number,
  is_default_plan: 0 | 1,
}

// TODO: handle apple pay payment info
export type State = {
  availablePlans: ?AvailablePlans,
  plan: ?PlanInfo,
  usage: ?UsageInfo,
  paymentInfo: ?PaymentInfo,
  errorMessage: ?string,
}

export type BillingError = TypedAction<'plan-billing:billingError', void, {errorText: string}>
export type BootstrapData = NoErrorTypedAction<'plan-billing:bootstrapData', void>
export type FetchBillingAndQuota = NoErrorTypedAction<'plan-billing:fetchBillingAndQuota', void>
export type FetchBillingOverview = NoErrorTypedAction<'plan-billing:fetchBillingOverview', void>
export type UpdateBilling = NoErrorTypedAction<'plan-billing:updateBilling', UpdateBillingArgs>
export type UpdateAvailablePlans = NoErrorTypedAction<
  'plan-billing:updateAvailablePlans',
  {availablePlans: AvailablePlans}
>
export type UpdatePaymentInfo = TypedAction<
  'plan-billing:updatePaymentInfo',
  {paymentInfo: PaymentInfo},
  {error: any}
>
export type ChangeType = 'change' | 'upgrade' | 'downgrade'
export type UpdateBillingAndQuota = TypedAction<
  'plan-billing:updateBillingAndQuota',
  BillingAndQuota,
  {error: any}
>
export type Actions =
  | UpdateBilling
  | FetchBillingAndQuota
  | FetchBillingOverview
  | UpdateAvailablePlans
  | UpdateBillingAndQuota
