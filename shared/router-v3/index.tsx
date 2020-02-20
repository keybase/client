import * as React from 'react'
import * as Styles from '../styles'
import * as Container from '../util/container'
import * as ConfigGen from '../actions/config-gen'
import * as Shared from './shared'
import logger from '../logger'
import GlobalError from '../app/global-errors/container'
import OutOfDate from '../app/out-of-date'
import RuntimeStats from '../app/runtime-stats/container'
import {NavigationContainer, NavigationContainerRef} from '@react-navigation/native'
import {createStackNavigator} from '@react-navigation/stack'
import {StatusBar} from 'react-native'
import NavTabs from './tabs'

import {newModalRoutes as peopleNewModalRoutes} from '../people/routes'

const ModalStack = createStackNavigator()

const TeamBuildingModal = peopleNewModalRoutes.peopleTeamBuilder.getScreen()

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

const RouterV3 = () => {
  const isDarkMode = Styles.isDarkMode()
  const [nav, setNav] = React.useState<NavigationContainerRef>(null)
  const navIsSet = React.useRef(false)
  // TODO chagne routes
  //const loggedIn = Container.useSelector(state => state.config.loggedIn)
  return (
    <>
      <StatusBar barStyle={Styles.isAndroid ? 'default' : isDarkMode ? 'light-content' : 'dark-content'} />
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
          <ModalStack.Screen name="Tabs" component={NavTabs} />
          <ModalStack.Screen name="peopleTeamBuilder" component={TeamBuildingModal} />
        </ModalStack.Navigator>
      </NavigationContainer>
      <GlobalError />
      <OutOfDate />
      <RuntimeStats />
    </>
  )
}

export default RouterV3
