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
import ControlledRolePicker from './role-picker/controlled-container'
import Member from './team/member/container'
import ReallyRemoveMember from './team/really-remove-member/container'
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

const rolePicker = {
  children: {},
  component: RolePicker,
  tags: makeLeafTags({layerOnTop: !isMobile}),
}
const reallyLeaveTeam = {
  children: {},
  component: ReallyLeaveTeam,
  tags: makeLeafTags({layerOnTop: !isMobile}),
}
const controlledRolePicker = {
  children: {},
  component: ControlledRolePicker,
  tags: makeLeafTags({layerOnTop: !isMobile}),
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
        ...makeManageChannels,
        rolePicker,
        reallyLeaveTeam,
        member: {
          children: {
            rolePicker,
            reallyLeaveTeam,

            reallyRemoveMember: {
              children: {},
              component: ReallyRemoveMember,
              tags: makeLeafTags({layerOnTop: !isMobile}),
            },
          },
          component: Member,
        },
        addPeople: {
          children: {controlledRolePicker},
          component: AddPeopleDialog,
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
