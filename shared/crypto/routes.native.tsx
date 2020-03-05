import NativeSubNav from 'render.native'

export const newRoutes = {
  cryptoRoot: {
    getScreen: (): typeof NativeSubNav => require('./render.native').default,
  },
}
export const newModalRoutes = {}
