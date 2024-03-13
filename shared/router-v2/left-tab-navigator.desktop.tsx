import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import TabBar from './tab-bar.desktop'
import {useNavigationBuilder, TabRouter, createNavigatorFactory} from '@react-navigation/core'

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

  const renderedRef = React.useRef<{[key: string]: boolean}>({})
  // render if its been rendered before
  const shouldRender = React.useCallback((key: string, selected: boolean) => {
    if (renderedRef.current[key]) {
      return true
    }
    if (selected) {
      renderedRef.current[key] = true
      return true
    }
    return false
  }, [])

  const hasModals = C.useRouterState(s => C.Router2.getModalStack(s.navState).length > 0)

  return (
    <NavigationContent>
      <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={true} style={styles.box}>
        <TabBar state={state} navigation={navigation as any} />
        <Kb.BoxGrow>
          {state.routes.map((route, i) => {
            const routeKey = route.key
            const desc = descriptors[routeKey]
            const selected = i === state.index
            const needDesc = desc ? shouldRender(routeKey, selected) : false
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

export const createLeftTabNavigator = createNavigatorFactory(LeftTabNavigator)
