export const newRoutes = {
  accountSwitcher: {getScreen: () => require('../router-v2/account-switcher/container').default},
  peopleRoot: {getScreen: () => require('./container').default, upgraded: true},
}

export const newModalRoutes = {}
