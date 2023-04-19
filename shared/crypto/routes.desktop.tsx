import type TeamBuilder from '../team-building/container'
import type SubNav from './sub-nav/index.desktop'

/* Routes */
export const newRoutes = {
  // Crypto tab is driven by the sub nav on desktop
  cryptoRoot: {
    getOptions: {title: 'Crypto tools'},
    getScreen: (): typeof SubNav => require('./sub-nav/index.desktop').default,
    skipShim: true,
  },
}

export const newModalRoutes = {
  cryptoTeamBuilder: {getScreen: (): typeof TeamBuilder => require('../team-building/container').default},
}
