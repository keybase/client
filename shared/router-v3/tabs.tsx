// The main navigation tabs
import * as React from 'react'
import * as Styles from '../styles'
import * as Kb from '../common-adapters'
import * as Kbfs from '../fs/common'
import * as Tabs from '../constants/tabs'
import * as Container from '../util/container'
import * as FsConstants from '../constants/fs'
import {BottomTabBarProps} from '@react-navigation/bottom-tabs'
import {tabs} from './tab-stacks'
import {Tab} from './tab-factory'

const icons = new Map<string, Kb.IconType>([
  [Tabs.chatTab, 'iconfont-nav-2-chat'],
  [Tabs.fsTab, 'iconfont-nav-2-files'],
  [Tabs.teamsTab, 'iconfont-nav-2-teams'],
  [Tabs.peopleTab, 'iconfont-nav-2-people'],
  [Tabs.walletsTab, 'iconfont-nav-2-wallets'],
])

const FilesTabBadge = () => {
  const uploadIcon = FsConstants.getUploadIconForFilesTab(Container.useSelector(state => state.fs.badge))
  return uploadIcon ? <Kbfs.UploadIcon uploadIcon={uploadIcon} style={styles.fsBadgeIconUpload} /> : null
}

const TabBarIcon = ({focused, name, ...rest}) => {
  const settingsTabChildren: Array<Tabs.Tab> = [
    Tabs.gitTab,
    Tabs.devicesTab,
    Tabs.walletsTab,
    Tabs.settingsTab,
  ]
  const onSettings = name === Tabs.settingsTab
  const badgeNumber = Container.useSelector(state =>
    (onSettings ? settingsTabChildren : [name]).reduce(
      (res, tab) => res + (state.notifications.navBadges.get(tab) || 0),
      // notifications gets badged on native if there's no push, special case
      onSettings && !state.push.hasPermissions ? 1 : 0
    )
  )
  return (
    // note 'rest' required by TouchableWithoutFeedback, see docs
    <Kb.Box {...rest}>
      <Kb.Icon
        type={icons.get(name) ?? ('iconfont-nav-2-hamburger' as const)}
        fontSize={32}
        style={styles.tab}
        color={focused ? Styles.globalColors.whiteOrWhite : Styles.globalColors.blueDarkerOrBlack}
      />
      {!!badgeNumber && <Kb.Badge badgeNumber={badgeNumber} badgeStyle={styles.badge} />}
      {name === Tabs.fsTab && <FilesTabBadge />}
    </Kb.Box>
  )
}

const TabBar = (props: BottomTabBarProps) => {
  const {state, navigation} = props

  return (
    <Kb.Box2 direction="horizontal" style={styles.container}>
      {state.routes.map((route, index) => {
        if (route.name === 'blankTab') {
          return null
        }

        const isFocused = state.index === index

        const onPress = () => {
          const event = navigation.emit({
            canPreventDefault: true,
            target: route.key,
            type: 'tabPress',
          })

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name)
          }
        }
        return (
          <Kb.NativeTouchableWithoutFeedback key={route.name} onPressIn={onPress}>
            <TabBarIcon focused={isFocused} name={route.name} />
          </Kb.NativeTouchableWithoutFeedback>
        )
      })}
    </Kb.Box2>
  )
}

const NavTabs = () => {
  console.log('aaa tab render')
  return (
    <Tab.Navigator
      initialRouteName="blankTab"
      backBehavior="none"
      tabBar={TabBar}
      screenOptions={{keyboardHidesTabBar: Styles.isAndroid}}
    >
      {tabs}
    </Tab.Navigator>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  badge: {
    position: 'absolute',
    right: 8,
    top: 3,
  },
  container: {
    alignItems: 'center',
    backgroundColor: Styles.globalColors.blueDarkOrGreyDarkest,
    height: 48,
    width: '100%',
  },
  fsBadgeIconUpload: {
    bottom: Styles.globalMargins.tiny,
    height: Styles.globalMargins.small,
    position: 'absolute',
    right: Styles.globalMargins.small,
    width: Styles.globalMargins.small,
  },
  tab: Styles.platformStyles({
    common: {
      paddingBottom: 6,
      paddingLeft: 16,
      paddingRight: 16,
      paddingTop: 6,
    },
    isTablet: {
      width: '100%',
    },
  }),
}))

export default NavTabs
