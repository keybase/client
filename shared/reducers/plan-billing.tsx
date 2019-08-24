import logger from '../logger'
// @ts-ignore
import * as CommonConstants from '../constants/common'
import * as Constants from '../constants/plan-billing'
import * as Types from '../constants/types/plan-billing'

const initialState: Types.State = {
  availablePlans: null,
  errorMessage: null,
  paymentInfo: null,
  plan: null,
  usage: null,
}

export default function(
  state: Types.State = initialState,
  // TODO gen and type this if we actually use this thing
  action: any
): Types.State {
  switch (action.type) {
    case CommonConstants.resetStore:
      return {...initialState}
    case Constants.updateBillingAndQuota:
      if (action.error) {
        logger.warn('Error in action: ', action)
        return state
      }
      return {
        ...state,
        ...action.payload,
      }
    case Constants.updateAvailablePlans:
      if (action.error) {
        logger.warn('Error in action: ', action)
        return state
      }
      return {
        ...state,
        ...action.payload,
      }
    case Constants.updatePaymentInfo:
      if (action.error) {
        logger.warn('Error in action: ', action)
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
    default:
      return state
  }
}
