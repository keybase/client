// @flow
import {type TypedState} from '../constants/reducer'
export function selector(): (store: TypedState) => ?Object {
  return store => ({
    pinentry: {
      pinentryStates: store.pinentry.pinentryStates || {},
    },
  })
}
