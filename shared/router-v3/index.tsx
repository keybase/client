import * as React from 'react'
import * as Container from '../util/container'
import * as ConfigGen from '../actions/config-gen'
import * as Shared from './shared'
import logger from '../logger'
import {NavigationContainer, NavigationContainerRef} from '@react-navigation/native'
import NavTabs from './tabs'
import {modalScreens} from './routes'
import {ModalStack} from './stack-factory'

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

const tabsAndModals = [
  ...modalScreens,
  <ModalStack.Screen key="Tabs" name="Tabs" component={NavTabs} options={{headerShown: false}} />,
]

const RouterV3 = () => {
  const [nav, setNav] = React.useState<NavigationContainerRef | null>(null)
  const navIsSet = React.useRef(false)
  // TODO chagne routes
  //const loggedIn = Container.useSelector(state => state.config.loggedIn)
  return (
    <>
      <ReduxPlumbing navRef={nav} />
      <NavigationContainer
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
  cardStyle: {
    backgroundColor: 'red',
  },
}

export default RouterV3
