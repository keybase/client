import * as Constants from '../constants/team-building'
import * as Container from '../util/container'
import * as RouteTreeGen from './route-tree-gen'
import * as RouterConstants from '../constants/router2'
import type * as Types from '../constants/types/team-building'

const namespaceToRoute = new Map([
  ['chat2', 'chatNewChat'],
  ['crypto', 'cryptoTeamBuilder'],
  ['teams', 'teamsTeamBuilder'],
  ['people', 'peopleTeamBuilder'],
  ['wallets', 'walletTeamBuilder'],
])

const initTeamBuilding = () => {
  Container.listenAction(RouteTreeGen.onNavChanged, (_, action) => {
    const {prev, next} = action.payload
    const namespaces: Array<Types.AllowedNamespace> = ['chat2', 'crypto', 'teams', 'people', 'wallets']
    for (const namespace of namespaces) {
      const wasTeamBuilding = namespaceToRoute.get(namespace) === RouterConstants.getVisibleScreen(prev)?.name
      if (wasTeamBuilding) {
        // team building or modal on top of that still
        const isTeamBuilding =
          namespaceToRoute.get(namespace) === RouterConstants.getVisibleScreen(next)?.name
        if (!isTeamBuilding) {
          Constants.stores.get(namespace)?.getState().dispatch.cancelTeamBuilding()
        }
      }
    }
  })
}
export default initTeamBuilding
