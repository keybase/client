// @flow
export function selector(): (store: Object) => ?Object {
  return store => ({
    pinentry: {
      pinentryStates: store.pinentry.pinentryStates || {},
    },
  })
}
