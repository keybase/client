// @flow
import {RouteDefNode} from '../route-tree'
import chatRoutes from '../chat/routes'
import loginRoutes from '../login/routes'
import devicesRoutes from '../devices/routes'
import foldersRoutes from '../folders/routes'
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
} from '../constants/tabs'

const routeTree = new RouteDefNode({
  children: {
    [chatTab]: chatRoutes,
    [folderTab]: foldersRoutes,
    [loginTab]: loginRoutes,
    [peopleTab]: profileRoutes,
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
