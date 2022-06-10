import type IncomingShareChat from '.'

export const newModalRoutes = {
  incomingShareNew: {
    getScreen: (): typeof IncomingShareChat => require('.').default,
  },
}

export type RootParamListIncomingShare = {
  incomingShareNew: undefined
}
