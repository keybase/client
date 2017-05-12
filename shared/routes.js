// @flow
import {RouteDefNode} from './route-tree'
import chatRoutes from './chat/routes'
import loginRoutes from './login/routes'
import devicesRoutes from './devices/routes'
import foldersRoutes from './folders/routes'
import profileRoutes from './profile/routes'
import searchRoutes from './search/routes'
import settingsRoutes from './settings/routes'
import Nav from './nav'
import {isMobile} from './constants/platform'
import {
  chatTab,
  loginTab,
  profileTab,
  folderTab,
  devicesTab,
  searchTab,
  settingsTab,
} from './constants/tabs'

const routeTree = new RouteDefNode({
  defaultSelected: loginTab,
  containerComponent: Nav,
  children: {
    [chatTab]: chatRoutes,
    [loginTab]: loginRoutes,
    [folderTab]: foldersRoutes,
    ...(isMobile
      ? {}
      : {
          [devicesTab]: devicesRoutes, // not a top level route in mobile
        }),
    [profileTab]: profileRoutes,
    [searchTab]: searchRoutes,
    [settingsTab]: settingsRoutes,
  },
})

const NOT_USED = 1

export default routeTree
