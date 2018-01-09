// @flow
import {makeRouteDefNode} from '../route-tree'
import chatRoutes from '../chat/routes'
import loginRoutes from '../login/routes'
import devicesRoutes from '../devices/routes'
import gitRoutes from '../git/routes'
import foldersRoutes from '../folders/routes'
import peopleRoutes from '../people/routes'
import profileRoutes from '../profile/routes'
import settingsRoutes from '../settings/routes'
import teamsRoutes from '../teams/routes'
import Nav from './nav'
import {isMobile} from '../constants/platform'
import {
  chatTab,
  devicesTab,
  folderTab,
  loginTab,
  peopleTab,
  profileTab,
  settingsTab,
  teamsTab,
  gitTab,
} from '../constants/tabs'
import flags from '../util/feature-flags'

const routeTree = makeRouteDefNode({
  children: {
    [chatTab]: chatRoutes,
    [folderTab]: foldersRoutes,
    [gitTab]: gitRoutes,
    [loginTab]: loginRoutes,
    [peopleTab]: flags.newPeopleTab ? peopleRoutes : profileRoutes,
    [profileTab]: profileRoutes,
    [settingsTab]: settingsRoutes,
    [teamsTab]: teamsRoutes,
    ...(isMobile
      ? {}
      : {
          [devicesTab]: devicesRoutes, // not a top level route in mobile
        }),
  },
  containerComponent: Nav,
  defaultSelected: loginTab,
})

export default routeTree
