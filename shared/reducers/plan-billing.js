// @flow

import * as CommonConstants from '../constants/common'
import * as Constants from '../constants/plan-billing'
import type {BillingState, Actions} from '../constants/plan-billing'

const initialState: BillingState = {
  availablePlans: null,
  plan: null,
  usage: null,
  paymentInfo: null,
  errorMessage: null,
}

export default function (state: BillingState = initialState, action: Actions): BillingState {
  switch (action.type) {
    case CommonConstants.resetStore:
      return {...initialState}
    case Constants.updateBillingAndQuota:
      if (action.error) {
        console.warn('Error in action: ', action)
        return state
      }
      return {
        ...state,
        ...action.payload,
      }
    case Constants.updateAvailablePlans:
      if (action.error) {
        console.warn('Error in action: ', action)
        return state
      }
      return {
        ...state,
        ...action.payload,
      }
    case Constants.updatePaymentInfo:
      if (action.error) {
        console.warn('Error in action: ', action)
        return state
      }
      return {
        ...state,
        ...action.payload,
      }
    case Constants.billingError:
      if (action.error) {
        return {
          ...state,
          errorMessage: action.payload.errorText,
        }
      }
      return {
        ...state,
        errorMessage: null,
      }
  }
  return state
}
