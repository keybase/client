import AndroidChooseTarget from './android-choose-target'
import IOSChooseTarget from './ios-choose-target'
import IncomingShareChat from '.'

export const newModalRoutes = {
  androidChooseTarget: {
    getScreen: (): typeof AndroidChooseTarget => require('./android-choose-target').default,
  },
  incomingShareNew: {
    getScreen: (): typeof IncomingShareChat => require('.').default,
  },
  iosChooseTarget: {
    getScreen: (): typeof IOSChooseTarget => require('./ios-choose-target').default,
  },
}
