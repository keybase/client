import CryptoSubNav from './sub-nav'
import Encrypt from './operations/encrypt'

export const newRoutes = {
  cryptoRoot: {
    getScreen: (): typeof CryptoSubNav => require('./sub-nav').default,
  },
  encrypt: {
    getScreen: (): typeof
  }
}
export const newModalRoutes = {}
