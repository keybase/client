import CryptoSubNav from './sub-nav'

export const newRoutes = {
  cryptoRoot: {
    getScreen: (): typeof CryptoSubNav => require('./sub-nav').default,
  },
}
export const newModalRoutes = {}
