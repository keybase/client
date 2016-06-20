/*
 * Define platform specific offsets and heights and etc here
 */
import NavigatorNavigationBarStyles from 'react-native/Libraries/CustomComponents/Navigator/NavigatorNavigationBarStylesIOS'
import {StyleSheet} from 'react-native'

export default {
  navBarHeight: NavigatorNavigationBarStyles.General.TotalNavHeight,
  tabBarHeight: 48,
}

export const styles = {
}

export function sheet (obj) {
  return StyleSheet.create(obj)
}
