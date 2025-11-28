import {isMobile} from '@/constants/platform'
import * as Tabs from '@/constants/tabs'
import type {RouteMap} from '@/constants/types/router2'

// Lazy load route definitions
const getRouteModule = (path: string) => {
  switch (path) {
    case 'chat': return require('../chat/routes')
    case 'crypto': return require('../crypto/routes')
    case 'devices': return require('../devices/routes')
    case 'fs': return require('@/fs/routes')
    case 'git': return require('../git/routes')
    case 'login': return require('../login/routes')
    case 'people': return require('../people/routes')
    case 'profile': return require('../profile/routes')
    case 'settings': return require('../settings/routes')
    case 'signup': return require('../signup/routes')
    case 'teams': return require('../teams/routes')
    case 'wallets': return require('../wallets/routes')
    case 'incomingShare': return require('../incoming-share/routes')
    default: throw new Error('Unknown route module: ' + path)
  }
}

type RoutePlusTab = {module: string; tab: Tabs.Tab; includeModal?: boolean}

const routeConfigs: ReadonlyArray<RoutePlusTab> = [
  {module: 'devices', tab: isMobile ? Tabs.settingsTab : Tabs.devicesTab},
  {module: 'chat', tab: Tabs.chatTab, includeModal: true},
  {module: 'crypto', tab: Tabs.cryptoTab, includeModal: true},
  {module: 'people', tab: Tabs.peopleTab, includeModal: true},
  {module: 'profile', tab: Tabs.peopleTab, includeModal: true},
  {module: 'fs', tab: Tabs.fsTab, includeModal: true},
  {module: 'settings', tab: Tabs.settingsTab, includeModal: true},
  {module: 'teams', tab: Tabs.teamsTab, includeModal: true},
  {module: 'git', tab: Tabs.gitTab, includeModal: true},
]

const modalOnlyConfigs = ['login', 'signup', 'wallets', 'incomingShare'] as const

let _routes: RouteMap | undefined
let _modalRoutes: RouteMap | undefined
let _loggedOutRoutes: RouteMap | undefined

export const tabRoots = {
  [Tabs.peopleTab]: 'peopleRoot',
  [Tabs.chatTab]: 'chatRoot',
  [Tabs.cryptoTab]: 'cryptoRoot',
  [Tabs.fsTab]: 'fsRoot',
  [Tabs.teamsTab]: 'teamsRoot',
  [Tabs.gitTab]: 'gitRoot',
  [Tabs.devicesTab]: 'devicesRoot',
  [Tabs.settingsTab]: 'settingsRoot',

  [Tabs.loginTab]: '',
  [Tabs.searchTab]: '',
} as const

Object.defineProperty(exports, 'routes', {
  get: () => {
    if (_routes) return _routes
    _routes = {}
    const seenNames = new Set<string>()
    
    routeConfigs.forEach(({module}) => {
      const {newRoutes} = getRouteModule(module)
      Object.keys(newRoutes).forEach(name => {
        if (seenNames.has(name)) {
          throw new Error('New route with dupe name, disallowed! ' + name)
        }
        seenNames.add(name)
        _routes![name] = newRoutes[name]
      })
    })
    
    return _routes
  }
})

Object.defineProperty(exports, 'modalRoutes', {
  get: () => {
    if (_modalRoutes) return _modalRoutes
    _modalRoutes = {}
    
    routeConfigs.forEach(({module, includeModal}) => {
      if (!includeModal) return
      const {newModalRoutes} = getRouteModule(module)
      Object.keys(newModalRoutes).forEach(name => {
        if (_modalRoutes![name]) {
          throw new Error('New modal route with dupe name, disallowed! ' + name)
        }
        _modalRoutes![name] = newModalRoutes[name]
      })
    })
    
    modalOnlyConfigs.forEach(module => {
      const {newModalRoutes} = getRouteModule(module)
      Object.keys(newModalRoutes).forEach(name => {
        if (_modalRoutes![name]) {
          throw new Error('New modal route with dupe name, disallowed! ' + name)
        }
        _modalRoutes![name] = newModalRoutes[name]
      })
    })
    
    return _modalRoutes
  }
})

Object.defineProperty(exports, 'loggedOutRoutes', {
  get: () => {
    if (_loggedOutRoutes) return _loggedOutRoutes
    const {newRoutes: _loggedOutR} = getRouteModule('login')
    const {newRoutes: signupNewRoutes} = getRouteModule('signup')
    _loggedOutRoutes = {..._loggedOutR, ...signupNewRoutes}
    return _loggedOutRoutes
  }
})
