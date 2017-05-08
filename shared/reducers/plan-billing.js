// @flow
import * as CommonConstants from '../constants/common'
import * as Constants from '../constants/plan-billing'

const initialState: Constants.State = {
  availablePlans: null,
  errorMessage: null,
  paymentInfo: null,
  plan: null,
  usage: null,
}

export default function (state: Constants.State = initialState, action: Constants.Actions): Constants.State {
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
