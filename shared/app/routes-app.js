// @flow
import {makeLeafTags, makeRouteDefNode} from '../route-tree'
import chatRoutes from '../chat/routes'
import devicesRoutes from '../devices/routes'
import fsRoutes from '../fs/routes'
import gitRoutes from '../git/routes'
import peopleRoutes from '../people/routes'
import profileRoutes from '../profile/routes'
import settingsRoutes from '../settings/routes'
import teamsRoutes from '../teams/routes'
import walletsRoutes from '../wallets/routes'
import Nav from './nav'
import {isMobile} from '../constants/platform'
import {
  chatTab,
  devicesTab,
  peopleTab,
  profileTab,
  settingsTab,
  teamsTab,
  fsTab,
  gitTab,
  walletsTab,
} from '../constants/tabs'
import flags from '../util/feature-flags'
import {appRouteTreeTitle} from './route-constants'

const appRouteTree = makeRouteDefNode({
  tags: makeLeafTags({title: appRouteTreeTitle}),
  children: {
    [chatTab]: chatRoutes,
    [gitTab]: gitRoutes,
    [peopleTab]: peopleRoutes,
    [profileTab]: profileRoutes,
    [settingsTab]: settingsRoutes,
    [teamsTab]: teamsRoutes,
    ...(flags.walletsEnabled && !isMobile ? {[walletsTab]: walletsRoutes} : {}),
    ...(isMobile
      ? {}
      : {
          [devicesTab]: devicesRoutes, // not a top level route in mobile
          [fsTab]: fsRoutes,
        }),
  },
  containerComponent: Nav,
  defaultSelected: peopleTab,
})

export default appRouteTree
