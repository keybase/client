import HiddenString from '../../util/hidden-string'
import {PlanLevel} from './settings'

export type UpdateBillingArgs = {
  planId?: string
  cardNumber: HiddenString
  nameOnCard: HiddenString
  securityCode: HiddenString
  cardExpMonth: HiddenString
  cardExpYear: HiddenString
}

export type PlanInfoAPI = {
  plan_id: string
  plan_name: 'BASIC' | 'GOLD' | 'FRIEND'
  price_pennies: number
  gigabytes: number
  num_groups: number
  folders_with_writes: number
  billing_status: number
  test_mode: any | null
}

export type UsageInfoAPI = {
  gigabytes: number
  num_groups: number
  folders_with_writes: number
}

export type BillingAndQuotaAPI = {
  plan: PlanInfoAPI
  usage: UsageInfoAPI
}

export type PlanInfo = {
  planLevel: PlanLevel
  planId: string
  gigabytes: number
}

export type UsageInfo = {
  gigabytes: number
}

export type BillingAndQuota = {
  plan: PlanInfo
  usage: UsageInfo
}

export type AvailablePlan = {
  planLevel: PlanLevel
  planId: string
  gigabytes: number
  price_pennies: number
}

export type PaymentInfo = {
  name: string
  last4Digits: string
  isBroken: boolean
}

export type PaymentInfoAPI = {
  last4: string
  name: string
  cvc_check: 'pass' | any
}

export type AvailablePlans = Array<AvailablePlan>

export type AvailablePlanAPI = {
  plan_name: string
  plan_id: string
  price_pennies: number
  gigabytes: number
  is_default_plan: 0 | 1
}

// TODO: handle apple pay payment info
export type State = {
  availablePlans: AvailablePlans | null
  plan: PlanInfo | null
  usage: UsageInfo | null
  paymentInfo: PaymentInfo | null
  errorMessage: string | null
}

// TODO generate this
export type BillingError = {
  type: 'plan-billing:billingError'
  payload: {
    errorText: string
  }
}
export type BootstrapData = {
  type: 'plan-billing:bootstrapData'
  payload: void
}
export type FetchBillingAndQuota = {
  type: 'plan-billing:fetchBillingAndQuota'
  payload: void
}
export type FetchBillingOverview = {
  type: 'plan-billing:fetchBillingOverview'
  payload: void
}
export type UpdateBilling = {
  type: 'plan-billing:updateBilling'
  payload: UpdateBillingArgs
}
export type UpdateAvailablePlans = {
  type: 'plan-billing:updateAvailablePlans'
  payload: {
    availablePlans: AvailablePlans
  }
}
export type UpdatePaymentInfo = {
  type: 'plan-billing:updatePaymentInfo'
  payload: {
    paymentInfo: PaymentInfo
  }
  // {error: any}
}
export type ChangeType = 'change' | 'upgrade' | 'downgrade'
export type UpdateBillingAndQuota = {
  type: 'plan-billing:updateBillingAndQuota'
  payload: BillingAndQuota
  // {error: any}
}
export type Actions =
  | UpdateBilling
  | FetchBillingAndQuota
  | FetchBillingOverview
  | UpdateAvailablePlans
  | UpdateBillingAndQuota
