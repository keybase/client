import CryptoSubNav from './crypto-sub-nav'
import TeamBuilder from '../team-building/container'
export const newRoutes = {
  //. Crypto tab is driven by the sub nav on desktop
  cryptoRoot: {
    // MUST use screen and not getScreen for subnavs!
    screen: CryptoSubNav,
  },
}

export const newModalRoutes = {
  cryptoTeamBuilder: {getScreen: (): typeof TeamBuilder => require('../team-building/container').default},
}
