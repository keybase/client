import * as Kb from '@/common-adapters'
import * as Tabs from '@/constants/tabs'
import * as C from '@/constants'
import * as React from 'react'
import * as Shared from './router.shared'
import {View} from 'react-native'
import {useSafeAreaFrame} from 'react-native-safe-area-context'
import {useColorScheme} from 'react-native'
import {usePushState} from '@/stores/push'
import {useNotifState} from '@/stores/notifications'

const settingsTabChildren = [Tabs.gitTab, Tabs.devicesTab, Tabs.settingsTab] as const
const tabs = C.isTablet ? Tabs.tabletTabs : Tabs.phoneTabs
const tabToData = new Map<C.Tabs.Tab, {icon: Kb.IconType; label: string}>([
  [Tabs.chatTab, {icon: 'iconfont-nav-2-chat', label: 'Chat'}],
  [Tabs.fsTab, {icon: 'iconfont-nav-2-files', label: 'Files'}],
  [Tabs.teamsTab, {icon: 'iconfont-nav-2-teams', label: 'Teams'}],
  [Tabs.peopleTab, {icon: 'iconfont-nav-2-people', label: 'People'}],
  [Tabs.settingsTab, {icon: 'iconfont-nav-2-hamburger', label: 'More'}],
] as const)

export const TabBarIcon = React.memo(function TabBarIconImpl(props: {
  isFocused: boolean
  routeName: Tabs.Tab
}) {
  const {isFocused, routeName} = props
  const navBadges = useNotifState(s => s.navBadges)
  const hasPermissions = usePushState(s => s.hasPermissions)
  const onSettings = routeName === Tabs.settingsTab
  const tabsToCount: ReadonlyArray<Tabs.Tab> = onSettings ? settingsTabChildren : [routeName]
  const badgeNumber = tabsToCount.reduce(
    (res, tab) => res + (navBadges.get(tab) || 0),
    // notifications gets badged on native if there's no push, special case
    onSettings && !hasPermissions ? 1 : 0
  )
  const {width: screenWidth} = useSafeAreaFrame()
  const data = tabToData.get(routeName)
  return data ? (
    <View
      style={[
        styles.tabContainer,
        C.isTablet ? {minHeight: 50} : {minHeight: 40, minWidth: screenWidth / tabs.length},
      ]}
    >
      <Kb.Icon
        type={data.icon}
        fontSize={32}
        style={styles.tab}
        color={isFocused ? Kb.Styles.globalColors.whiteOrWhite : Kb.Styles.globalColors.blueDarkerOrBlack}
      />
      {!!badgeNumber && <Kb.Badge badgeNumber={badgeNumber} badgeStyle={styles.badge} />}
      {routeName === Tabs.fsTab && <Shared.FilesTabBadge />}
    </View>
  ) : null
})

type TabIconProps = {routeName: Tabs.Tab; focused: boolean}
export const TabBarIconWrapper = React.memo(function TabBarIconWrapper(p: TabIconProps) {
  return <TabBarIcon isFocused={p.focused} routeName={p.routeName} />
})
export const TabBarLabelWrapper = React.memo(function TabBarLabelWrapper(p: TabIconProps) {
  const data = tabToData.get(p.routeName)
  const isDarkMode = useColorScheme() === 'dark'
  return (
    <Kb.Text
      style={Kb.Styles.collapseStyles([
        styles.label,
        isDarkMode
          ? p.focused
            ? styles.labelDarkModeFocused
            : styles.labelDarkMode
          : p.focused
            ? styles.labelLightModeFocused
            : styles.labelLightMode,
      ])}
      type="BodyBig"
    >
      {data?.label}
    </Kb.Text>
  )
})

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      badge: Kb.Styles.platformStyles({
        common: {
          left: 36,
          position: 'absolute',
          top: 3,
        },
      }),
      label: {marginLeft: Kb.Styles.globalMargins.medium},
      labelDarkMode: {color: Kb.Styles.globalColors.black_50},
      labelDarkModeFocused: {color: Kb.Styles.globalColors.black},
      labelLightMode: {color: Kb.Styles.globalColors.blueLighter},
      labelLightModeFocused: {color: Kb.Styles.globalColors.white},
      tab: Kb.Styles.platformStyles({
        common: {
          backgroundColor: Kb.Styles.globalColors.blueDarkOrGreyDarkest,
          paddingBottom: 6,
          paddingLeft: 16,
          paddingRight: 16,
          paddingTop: 6,
        },
        isTablet: {width: '100%'},
      }),
      tabContainer: Kb.Styles.platformStyles({
        common: {
          flex: 1,
          justifyContent: 'center',
        },
        isTablet: {
          // This is to circumvent a React Navigation AnimatedComponent with minWidth: 64 that wraps TabBarIcon
          minWidth: Kb.Styles.globalMargins.xlarge,
        },
      }),
    }) as const
)
