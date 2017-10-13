// @flow
import TeamsContainer from './container'
import AddPeopleDialog from './add-people/container'
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import NewTeamDialog from './new-team/container'
import JoinTeamDialog from './join-team/container'
import ManageChannels from '../chat/manage-channels/container'
import CreateChannel from '../chat/create-channel/container'
import ReallyLeaveTeam from './really-leave-team/container'
import RolePicker from './role-picker/container'
import Team from './team/container'
import {isMobile} from '../constants/platform'

const makeManageChannels = {
  manageChannels: {
    children: {},
    component: ManageChannels,
    tags: makeLeafTags({hideStatusBar: true, layerOnTop: !isMobile}),
  },
  createChannel: {
    children: {},
    component: CreateChannel,
    tags: makeLeafTags({hideStatusBar: true, layerOnTop: !isMobile}),
  },
}

const routeTree = makeRouteDefNode({
  children: {
    ...makeManageChannels,
    showNewTeamDialog: {
      children: {},
      component: NewTeamDialog,
      tags: makeLeafTags({layerOnTop: !isMobile}),
    },
    showJoinTeamDialog: {
      children: {},
      component: JoinTeamDialog,
      tags: makeLeafTags({layerOnTop: !isMobile}),
    },
    team: {
      children: {
<<<<<<< HEAD
        ...makeManageChannels(),
        addPeople: {
          children: {},
          component: AddPeopleDialog,
          tags: {layerOnTop: !isMobile},
        },
=======
        ...makeManageChannels,
>>>>>>> caa0d28b6f7a8ffc9999d584f88c113b3a436236
        reallyLeaveTeam: {
          children: {},
          component: ReallyLeaveTeam,
          tags: makeLeafTags({layerOnTop: !isMobile}),
        },
        rolePicker: {
          children: {},
          component: RolePicker,
          tags: makeLeafTags({layerOnTop: !isMobile}),
        },
      },
      component: Team,
    },
  },
  component: TeamsContainer,
  tags: makeLeafTags({title: 'Teams'}),
})

export default routeTree
