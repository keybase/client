import * as React from 'react'
import * as Styles from '../styles'
import * as Container from '../util/container'
import * as ConfigGen from '../actions/config-gen'
import * as Shared from './shared'
import logger from '../logger'
import {NavigationContainer, NavigationContainerRef} from '@react-navigation/native'
import {createStackNavigator} from '@react-navigation/stack'
import NavTabs from './tabs'
import {modalRoutes} from './routes'
import {memoize} from '../util/memoize'

const ModalStack = createStackNavigator()

const ReduxPlumbing = React.memo((props: {navRef: NavigationContainerRef | null}) => {
  const {navRef} = props
  const dispatch = Container.useDispatch()

  const navigator = {
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

      const actions = Shared.oldActionToNewActions(old, navRef) || []
      try {
        actions.forEach(a => navRef.dispatch(a))
      } catch (e) {
        logger.error('Nav error', e)
      }
    },
    // TODO wrong
    getNavState: () => navRef?.state?.nav ?? null,
  }

  // TEMP
  window.NOJIMA = navRef
  // TEMP

  React.useEffect(() => {
    dispatch(ConfigGen.createSetNavigator({navigator}))
  }, [dispatch, navigator])

  return null
})

const getModals = memoize(() =>
  Object.keys(modalRoutes).map(name => {
    // TODO is there a way to defer the require now?
    const Component = modalRoutes[name].getScreen()
    return <ModalStack.Screen key={name} name={name} component={Component} />
  })
)

const RouterV3 = () => {
  const [nav, setNav] = React.useState<NavigationContainerRef>(null)
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
            setNav(r)
          }
        }}
      >
        <ModalStack.Navigator mode="modal" screenOptions={{headerShown: false}} initialRouteName="Tabs">
          {[<ModalStack.Screen key="Tabs" name="Tabs" component={NavTabs} />, ...getModals()]}
        </ModalStack.Navigator>
      </NavigationContainer>
    </>
  )
}

export default RouterV3
