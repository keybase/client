import {capitalize} from 'lodash-es'
import * as Types from './types/plan-billing'

export function parseAvailablePlan({
  plan_name,
  gigabytes,
  plan_id,
  price_pennies,
}: Types.AvailablePlanAPI): Types.AvailablePlan {
  return {
    gigabytes,
    planId: plan_id,
    planLevel: capitalize(plan_name.toLowerCase()),
    price_pennies,
  }
}

export function parsePaymentInfo({last4, name, cvc_check}: Types.PaymentInfoAPI): Types.PaymentInfo {
  return {
    name,
    isBroken: cvc_check !== 'pass', // eslint-disable-line
    last4Digits: last4,
  }
}

// We are expecting the string to be in the format of MM/YYYY
export function parseExpiration(
  expirationString: string
): {
  month: string
  year: string
  error?: string
} {
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
}: Types.BillingAndQuotaAPI): Types.BillingAndQuota {
  return {
    plan: {
      gigabytes: plan.gigabytes,
      planId: plan.plan_id,
      planLevel: capitalize(plan.plan_name.toLowerCase()),
    },
    usage: {
      gigabytes: usage.gigabytes,
    },
  }
}

export const billingError = 'plan-billing:billingError'
export const bootstrapData = 'plan-billing:bootstrapData'
export const fetchBillingAndQuota = 'plan-billing:fetchBillingAndQuota'
export const fetchBillingOverview = 'plan-billing:fetchBillingOverview'
export const updateAvailablePlans = 'plan-billing:updateAvailablePlans'
export const updateBilling = 'plan-billing:updateBilling'
export const updateBillingAndQuota = 'plan-billing:updateBillingAndQuota'
export const updatePaymentInfo = 'plan-billing:updatePaymentInfo'

export function planToStars(plan: string): number {
  return (
    {
      Basic: 1,
      Friend: 5,
      Gold: 3,
    }[plan] || 0
  )
}

export function comparePlans(from: Types.AvailablePlan, to: Types.AvailablePlan): Types.ChangeType {
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
