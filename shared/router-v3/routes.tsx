// Collects all the routable screens in the app
import * as React from 'react'
import {Stack} from './stack'
// New nav5 style
import {screens as chatScreens} from '../chat/routes-v3'

// TODO deprecate these old route defs
import {newRoutes as chatNewRoutes, newModalRoutes as chatNewModalRoutes} from '../chat/routes'
import {newRoutes as cryptoNewRoutes, newModalRoutes as cryptoNewModalRoutes} from '../crypto/routes'
import {newRoutes as deviceNewRoutes, newModalRoutes as deviceNewModalRoutes} from '../devices/routes'
import {newRoutes as fsNewRoutes, newModalRoutes as fsNewModalRoutes} from '../fs/routes'
import {newRoutes as gitNewRoutes, newModalRoutes as gitNewModalRoutes} from '../git/routes'
import {newRoutes as loggedOutRoutes, newModalRoutes as loginNewModalRoutes} from '../login/routes'
import {newRoutes as peopleNewRoutes, newModalRoutes as peopleNewModalRoutes} from '../people/routes'
import {newRoutes as profileNewRoutes, newModalRoutes as profileNewModalRoutes} from '../profile/routes'
import {newRoutes as settingsNewRoutes, newModalRoutes as settingsNewModalRoutes} from '../settings/routes'
import {newRoutes as signupNewRoutes, newModalRoutes as signupNewModalRoutes} from '../signup/routes'
import {newRoutes as teamsNewRoutes, newModalRoutes as teamsNewModalRoutes} from '../teams/routes'
import {newRoutes as walletsNewRoutes, newModalRoutes as walletsNewModalRoutes} from '../wallets/routes'
import {newModalRoutes as incomingShareNewModalRoutes} from '../incoming-share/routes'

const convertOldRouteToScreenShortTerm = routeMap =>
  Object.keys(routeMap).map(routeName => {
    const def = routeMap[routeName]
    const {getScreen} = def
    const Component = getScreen()
    const options = Component.navigationOptions
    // @ts-ignore
    return <Stack.Screen key={routeName} name={routeName} component={Component} options={options} />
  })

const convertedScreens = [...chatScreens]
/** TODO deprecate */
const notYetConvertedScreens = [
  deviceNewRoutes,
  chatNewRoutes,
  cryptoNewRoutes,
  peopleNewRoutes,
  profileNewRoutes,
  fsNewRoutes,
  settingsNewRoutes,
  teamsNewRoutes,
  walletsNewRoutes,
  gitNewRoutes,
].map(convertOldRouteToScreenShortTerm)

const convertedLoggedOutScreens = []
/** TODO deprecate */
const notYetConvertedLoggedOutScreens = [loggedOutRoutes, signupNewRoutes].map(
  convertOldRouteToScreenShortTerm
)

const convertedModalScreens = []
/** TODO deprecate */
const notYetConvertedModalScreens = [
  chatNewModalRoutes,
  cryptoNewModalRoutes,
  deviceNewModalRoutes,
  fsNewModalRoutes,
  gitNewModalRoutes,
  loginNewModalRoutes,
  peopleNewModalRoutes,
  profileNewModalRoutes,
  settingsNewModalRoutes,
  signupNewModalRoutes,
  teamsNewModalRoutes,
  walletsNewModalRoutes,
  incomingShareNewModalRoutes,
].map(convertOldRouteToScreenShortTerm)

export const screens = [...notYetConvertedScreens, ...convertedScreens]
export const loggedOutScreens = [...notYetConvertedLoggedOutScreens, ...convertedLoggedOutScreens]
export const modalScreens = [...notYetConvertedModalScreens, convertedModalScreens]
