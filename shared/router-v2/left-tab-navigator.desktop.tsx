import * as React from 'react'
import * as Kb from '@/common-adapters'
import TabBar from './tab-bar.desktop'
import {useNavigationBuilder, TabRouter, createNavigatorFactory} from '@react-navigation/core'
import type {TypedNavigator, NavigatorTypeBagBase} from '@react-navigation/native'
import type * as Tabs from '@/constants/tabs'
import {useRouterState} from '@/stores/router'
import {getModalStack} from '@/constants/router'

type BackBehavior = Parameters<typeof TabRouter>[0]['backBehavior']
type Props = Parameters<typeof useNavigationBuilder>[1] & {backBehavior: BackBehavior}
const tabRouter = TabRouter as unknown as Parameters<typeof useNavigationBuilder>[0]
function LeftTabNavigator({
  backBehavior,
  initialRouteName,
  children,
  screenOptions,
}: Props) {
  const {state, navigation, descriptors, NavigationContent} = useNavigationBuilder(tabRouter, {
    backBehavior,
    children,
    initialRouteName,
    screenOptions,
  })

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
            const selected = i === state.index
            const desc = descriptors[route.key]
            return (
              <React.Activity key={route.name} mode={selected ? 'visible' : 'hidden'}>
                <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true}>
                  {desc?.render()}
                </Kb.Box2>
              </React.Activity>
            )
          })}
        </Kb.BoxGrow>
        <ModalBackdrop hasModals={hasModals} />
      </Kb.Box2>
    </NavigationContent>
  )
}

function ModalBackdrop(p: {hasModals: boolean}) {
  const {hasModals} = p
  return <div className={Kb.Styles.classNames({'has-modals': hasModals, 'modal-backdrop': true})} />
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  box: {backgroundColor: Kb.Styles.globalColors.white},
}))

type NavType = NavigatorTypeBagBase & {
  ParamList: {
    [key in (typeof Tabs.desktopTabs)[number]]: undefined
  }
}

export const createLeftTabNavigator = createNavigatorFactory(LeftTabNavigator) as unknown as () => TypedNavigator<NavType>
