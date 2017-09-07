// @flow
import TeamsContainer from './container'
import {RouteDefNode} from '../route-tree'
import NewTeamDialog from './new-team/container'
import ManageChannels from '../chat/manage-channels/container'
import CreateChannel from '../chat/create-channel/container'
import ReallyLeaveTeam from './really-leave-team/container'
import Team from './team/container'
import {isMobile} from '../constants/platform'

const makeManageChannels = () => ({
  manageChannels: {
    children: {},
    component: ManageChannels,
    tags: {layerOnTop: true},
  },
  createChannel: {
    children: {},
    component: CreateChannel,
    tags: {layerOnTop: true},
  },
})

const routeTree = new RouteDefNode({
  children: {
    ...makeManageChannels(),
    showNewTeamDialog: {
      children: {},
      component: NewTeamDialog,
      tags: {layerOnTop: true},
    },
    team: {
      children: {
        ...makeManageChannels(),
        reallyLeaveTeam: {
          children: {},
          component: ReallyLeaveTeam,
          tags: {layerOnTop: !isMobile},
        },
      },
      component: Team,
    },
  },
  component: TeamsContainer,
  tags: {title: 'Teams'},
})

export default routeTree
