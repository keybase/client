import * as React from 'react'
import * as Kb from '@/common-adapters'
import TabBar from './tab-bar.desktop'
import {useNavigationBuilder, TabRouter, createNavigatorFactory} from '@react-navigation/core'
import type {TypedNavigator, NavigatorTypeBagBase, StaticConfig} from '@react-navigation/native'
import type * as Tabs from '@/constants/tabs'
import {useRouterState} from '@/stores/router2'
import {getModalStack} from '@/constants/router2'

type BackBehavior = Parameters<typeof TabRouter>[0]['backBehavior']
type Props = Parameters<typeof useNavigationBuilder>[1] & {backBehavior: BackBehavior}
type Desc = ReturnType<typeof useNavigationBuilder>['descriptors'][0]

// not memo as it changes every time
const RouteBox = (p: {desc?: Desc; selected: boolean}) => {
  const {desc, selected} = p
  return (
    <Kb.Box2
      direction="vertical"
      fullHeight={true}
      fullWidth={true}
      style={selected ? undefined : styles.hidden}
    >
      {desc?.render()}
    </Kb.Box2>
  )
}

const LeftTabNavigator = React.memo(function LeftTabNavigator({
  backBehavior,
  initialRouteName,
  children,
  screenOptions,
}: Props) {
  const {state, navigation, descriptors, NavigationContent} = useNavigationBuilder(TabRouter, {
    backBehavior,
    children,
    initialRouteName,
    screenOptions,
  })

  const {index: selectedIndex} = state
  const selectedRoute = state.routes[selectedIndex]?.key

  const [rendered, setRendered] = React.useState(new Set<string>(selectedRoute ? [selectedRoute] : []))
  React.useEffect(() => {
    if (!selectedRoute) return
    if (rendered.has(selectedRoute)) return
    const next = new Set(rendered)
    next.add(selectedRoute)
    setRendered(next)
  }, [selectedRoute, rendered])

  const hasModals = useRouterState(() => getModalStack().length > 0)

  return (
    <NavigationContent>
      <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={true} style={styles.box}>
        <TabBar
          state={state}
          navigation={
            // eslint-disable-next-line
            navigation as any
          }
        />
        <Kb.BoxGrow>
          {state.routes.map((route, i) => {
            const routeKey = route.key
            const desc = descriptors[routeKey]
            const selected = i === state.index
            const needDesc = desc ? rendered.has(routeKey) : false
            return <RouteBox key={route.name} selected={selected} desc={needDesc ? desc : undefined} />
          })}
        </Kb.BoxGrow>
        <ModalBackdrop hasModals={hasModals} />
      </Kb.Box2>
    </NavigationContent>
  )
})

const ModalBackdrop = React.memo(function ModalBackdrop(p: {hasModals: boolean}) {
  const {hasModals} = p
  return <div className={Kb.Styles.classNames({'has-modals': hasModals, 'modal-backdrop': true})} />
})

const styles = Kb.Styles.styleSheetCreate(() => ({
  box: {backgroundColor: Kb.Styles.globalColors.white},
  hidden: {display: 'none'},
}))

type NavType = NavigatorTypeBagBase & {
  ParamList: {
    [key in (typeof Tabs.desktopTabs)[number]]: undefined
  }
}

export const createLeftTabNavigator = createNavigatorFactory(LeftTabNavigator) as () => TypedNavigator<
  NavType,
  StaticConfig<NavigatorTypeBagBase>
>
