import AndroidChooseTarget from './android-choose-target'
import IOSChooseTarget from './ios-choose-target'

export const newModalRoutes = {
  androidChooseTarget: {
    getScreen: (): typeof AndroidChooseTarget => require('./android-choose-target').default,
  },
  iosChooseTarget: {
    getScreen: (): typeof IOSChooseTarget => require('./ios-choose-target').default,
  },
}
