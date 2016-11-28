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
import {
  chatTab,
  loginTab,
  peopleTab,
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
    [devicesTab]: devicesRoutes,
    [profileTab]: profileRoutes,
    [peopleTab]: searchRoutes,  // native
    [searchTab]: searchRoutes,  // desktop
    [settingsTab]: settingsRoutes,
  },
})

export default routeTree
