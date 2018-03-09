// @flow
import {makeLeafTags, makeRouteDefNode} from '../route-tree'
import chatRoutes from '../chat/routes'
import loginRoutes from '../login/routes'
import devicesRoutes from '../devices/routes'
import fsRoutes from '../fs/routes'
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
  fsTab,
  gitTab,
} from '../constants/tabs'
import flags from '../util/feature-flags'

const loginRouteTreeTitle = 'LoginRoot'

// TODO: We have only a single tab, so consider making loginRoutes the
// root.
const loginRouteTree = makeRouteDefNode({
  tags: makeLeafTags({title: loginRouteTreeTitle}),
  children: {
    [loginTab]: loginRoutes,
  },
  containerComponent: Nav,
  defaultSelected: loginTab,
})

const appRouteTreeTitle = 'AppRoot'

const appRouteTree = makeRouteDefNode({
  tags: makeLeafTags({title: appRouteTreeTitle}),
  children: {
    [chatTab]: chatRoutes,
    [folderTab]: foldersRoutes,
    [gitTab]: gitRoutes,
    [peopleTab]: peopleRoutes,
    [profileTab]: profileRoutes,
    [settingsTab]: settingsRoutes,
    [teamsTab]: teamsRoutes,
    ...(flags.fsEnabled
      ? {
          [fsTab]: fsRoutes,
        }
      : {}),
    ...(isMobile
      ? {}
      : {
          [devicesTab]: devicesRoutes, // not a top level route in mobile
        }),
  },
  containerComponent: Nav,
  defaultSelected: peopleTab,
})

export {loginRouteTreeTitle, loginRouteTree, appRouteTreeTitle, appRouteTree}
