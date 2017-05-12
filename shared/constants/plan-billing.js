// @flow

import HiddenString from '../util/hidden-string'
import {capitalize} from 'lodash'

import type {PlanLevel} from './settings'
import type {TypedAction, NoErrorTypedAction} from '../constants/types/flux'

export type UpdateBillingArgs = {
  planId?: string,
  cardNumber: HiddenString,
  nameOnCard: HiddenString,
  securityCode: HiddenString,
  cardExpMonth: HiddenString,
  cardExpYear: HiddenString,
}

type PlanInfoAPI = {
  plan_id: string,
  plan_name: 'BASIC' | 'GOLD' | 'FRIEND',
  price_pennies: number,
  gigabytes: number,
  num_groups: number,
  folders_with_writes: number,
  billing_status: number,
  test_mode: ?any,
}

type UsageInfoAPI = {
  gigabytes: number,
  num_groups: number,
  folders_with_writes: number,
}

type BillingAndQuotaAPI = {
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

type PaymentInfoAPI = {
  last4: string,
  name: string,
  cvc_check: 'pass' | any,
}

export type AvailablePlans = Array<AvailablePlan>

type AvailablePlanAPI = {
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

export function parseAvailablePlan({
  plan_name,
  gigabytes,
  plan_id,
  price_pennies,
}: AvailablePlanAPI): AvailablePlan {
  return {
    planLevel: capitalize(plan_name.toLowerCase()),
    planId: plan_id,
    gigabytes,
    price_pennies,
  }
}

export function parsePaymentInfo({
  last4,
  name,
  cvc_check,
}: PaymentInfoAPI): PaymentInfo {
  return {
    name,
    isBroken: cvc_check !== 'pass', // eslint-disable-line
    last4Digits: last4,
  }
}

// We are expecting the string to be in the format of MM/YYYY
export function parseExpiration(
  expirationString: string
): {month: string, year: string, error?: string} {
  if (expirationString.length !== 7) {
    return {
      error: 'Not the right size. should be MM/YYYY. E.g. Jan 2018 -> 01/2018',
      month: '00',
      year: '0000',
    }
  }

  return {
    month: expirationString.substring(0, 2),
    year: expirationString.substring(3),
  }
}

export function billingAndQuotaAPIToOurBillingAndQuota({
  plan,
  usage,
}: BillingAndQuotaAPI): BillingAndQuota {
  return {
    plan: {
      gigabytes: plan.gigabytes,
      planLevel: capitalize(plan.plan_name.toLowerCase()),
      planId: plan.plan_id,
    },
    usage: {
      gigabytes: usage.gigabytes,
    },
  }
}

export const updateBilling = 'plan-billing:updateBilling'
export type UpdateBilling = NoErrorTypedAction<
  'plan-billing:updateBilling',
  UpdateBillingArgs
>

export const billingError = 'plan-billing:billingError'
export type BillingError = TypedAction<
  'plan-billing:billingError',
  void,
  {errorText: string}
>

export const fetchBillingAndQuota = 'plan-billing:fetchBillingAndQuota'
export type FetchBillingAndQuota = NoErrorTypedAction<
  'plan-billing:fetchBillingAndQuota',
  void
>

export const bootstrapData = 'plan-billing:bootstrapData'
export type BootstrapData = NoErrorTypedAction<
  'plan-billing:bootstrapData',
  void
>

export const fetchBillingOverview = 'plan-billing:fetchBillingOverview'
export type FetchBillingOverview = NoErrorTypedAction<
  'plan-billing:fetchBillingOverview',
  void
>

export const updateAvailablePlans = 'plan-billing:updateAvailablePlans'
export type UpdateAvailablePlans = NoErrorTypedAction<
  'plan-billing:updateAvailablePlans',
  {availablePlans: AvailablePlans}
>

export const updatePaymentInfo = 'plan-billing:updatePaymentInfo'
export type UpdatePaymentInfo = TypedAction<
  'plan-billing:updatePaymentInfo',
  {paymentInfo: PaymentInfo},
  {error: any}
>

export const updateBillingAndQuota = 'plan-billing:updateBillingAndQuota'
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

export function planToStars(plan: string): number {
  return (
    {
      Basic: 1,
      Gold: 3,
      Friend: 5,
    }[plan] || 0
  )
}

export type ChangeType = 'change' | 'upgrade' | 'downgrade'

export function comparePlans(
  from: AvailablePlan,
  to: AvailablePlan
): ChangeType {
  if (!from.price_pennies && to.price_pennies) {
    return 'upgrade'
  }
  if (from.price_pennies && !to.price_pennies) {
    return 'downgrade'
  }

  return 'change'
}

export function priceToString(pennies: number): string {
  if (!pennies) {
    return 'Free'
  } else {
    return `$${pennies / 100}/month`
  }
}
