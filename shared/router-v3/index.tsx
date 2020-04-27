import * as ConfigGen from '../actions/config-gen'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Container from '../util/container'
import * as Constants from '../constants/router3'
import * as React from 'react'
import * as Shared from './shared'
import * as Styles from '../styles'
import NavTabs from './tabs'
import logger from '../logger'
import {ModalStack} from './stack-factory'
import {NavigationContainer, NavigationContainerRef} from '@react-navigation/native'
import {modalScreens} from './routes'

const ReduxPlumbing = React.memo((props: {navRef: NavigationContainerRef | null}) => {
  const {navRef} = props
  const dispatch = Container.useDispatch()

  KB.debugConsoleLog('TEMP')
  window.NOJIMA = navRef

  React.useEffect(() => {
    if (!navRef) {
      return
    }
    console.log('aaa disaptch setnavigation')
    dispatch(
      ConfigGen.createSetNavigator({
        navigator: {
          dispatch: (a: any) => {
            if (!navRef) {
              throw new Error('Missing nav?')
            }
            navRef.dispatch(a)
          },
          dispatchOldAction: (old: any) => {
            if (!navRef) {
              throw new Error('Missing nav?')
            }

            //TODO better typing
            const actions: Array<any> = Shared.oldActionToNewActions(old, navRef) || []
            try {
              actions.forEach(a => navRef.dispatch(a))
            } catch (e) {
              logger.error('Nav error', e)
            }
          },
          getNavState: () => navRef.getRootState() ?? null,
        },
      })
    )
  }, [dispatch, navRef])

  return null
})

const tabsAndModals = [...modalScreens, <ModalStack.Screen key="Tabs" name="Tabs" component={NavTabs} />]

const RouterV3 = () => {
  const [nav, setNav] = React.useState<NavigationContainerRef | null>(null)
  const navIsSet = React.useRef(false)
  const dispatch = Container.useDispatch()

  /** used to stash the previous stack so we can do diffs */
  const prevStack = React.useRef<any>([])
  const onNavigationStateChange = React.useCallback(
    (state: any) => {
      const next = Constants.findVisibleRoute([], state)
      const prev = prevStack.current ?? []
      prevStack.current = next
      dispatch(RouteTreeGen.createOnNavChanged({next, prev}))
    },
    [dispatch]
  )
  // TODO chagne routes
  //const loggedIn = Container.useSelector(state => state.config.loggedIn)
  return (
    <>
      <ReduxPlumbing navRef={nav} />
      <NavigationContainer
        onStateChange={onNavigationStateChange}
        ref={r => {
          if (!navIsSet.current) {
            navIsSet.current = true
            console.log('aaa setting nav', r)
            setNav(r)
          }
        }}
      >
        <ModalStack.Navigator mode="modal" screenOptions={defaultModalScreenOptions} initialRouteName="Tabs">
          {tabsAndModals}
        </ModalStack.Navigator>
      </NavigationContainer>
    </>
  )
}

const defaultModalScreenOptions = {
  cardStyle: {backgroundColor: Styles.globalColors.white},
  headerShown: false,
}

export default RouterV3
