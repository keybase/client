import IncomingShareChat from '.'

export const newModalRoutes = {
  incomingShareNew: {
    getScreen: (): typeof IncomingShareChat => require('.').default,
  },
}
