// @flow
import {RouteDefNode} from './route-tree'
import loginRoutes from './login/routes'
import devicesRoutes from './devices/routes'
import foldersRoutes from './folders/routes'
import profileRoutes from './profile/routes'
import searchRoutes from './search/routes'
import settingsRoutes from './settings/routes'
import Nav from './nav'
import {
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
