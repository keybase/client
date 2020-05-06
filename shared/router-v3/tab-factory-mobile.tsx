import {createBottomTabNavigator} from '@react-navigation/bottom-tabs'

type ParamList = {
  blankTab: undefined
  'tabs.blankTab': undefined
  'tabs.chatTab': undefined
  'tabs.fsTab': undefined
  'tabs.peopleTab': undefined
  'tabs.settingsTab': undefined
  'tabs.teamsTab': undefined
}

const tabFactory = () => createBottomTabNavigator<ParamList>()
export default tabFactory
