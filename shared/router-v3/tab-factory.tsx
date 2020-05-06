import * as Container from '../util/container'
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs'
import desktopTabFactory from './tabs/desktop-tab-factory'

type ParamList = {
  blankTab: undefined
  'tabs.blankTab': undefined
  'tabs.chatTab': undefined
  'tabs.fsTab': undefined
  'tabs.peopleTab': undefined
  'tabs.settingsTab': undefined
  'tabs.teamsTab': undefined
  'tabs.cryptoTab': undefined
  'tabs.devicesTab': undefined
  'tabs.gitTab': undefined
  'tabs.walletsTab': undefined
}

const mobileTabFactory = createBottomTabNavigator<ParamList>()
type TabFactory = typeof mobileTabFactory

export const Tab = (Container.isMobile ? mobileTabFactory : desktopTabFactory) as TabFactory
