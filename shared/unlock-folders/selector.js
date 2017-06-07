// @flow

export function selector(): (store: Object) => ?Object {
  return store => ({unlockFolders: store.unlockFolders})
}
