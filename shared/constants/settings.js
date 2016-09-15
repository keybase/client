// @flow

export type PlanLevel = 'Basic' | 'Gold' | 'Friend'
export const plans: Array<PlanLevel> = ['Basic', 'Gold', 'Friend']

export type PaymentInfo = {
  name: string,
  last4Digits: string,
  isBroken: boolean,
}

