// @flow
import TeamsContainer from './container'
import {RouteDefNode} from '../route-tree'
import NewTeamDialog from './new-team/container'
import ManageChannels from '../chat/manage-channels/container'
import Team from './team/container'

const routeTree = new RouteDefNode({
  children: {
    manageChannels: {
      children: {},
      component: ManageChannels,
      tags: {layerOnTop: true},
    },
    showNewTeamDialog: {
      children: {},
      component: NewTeamDialog,
      tags: {layerOnTop: true},
    },
    team: {
      children: {
        manageChannels: {
          children: {},
          component: ManageChannels,
          tags: {layerOnTop: true},
        },
      },
      component: Team,
    },
  },
  component: TeamsContainer,
  tags: {title: 'Teams'},
})

export default routeTree
