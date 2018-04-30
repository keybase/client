// @flow
import TeamsContainer from './container'
import {MaybePopupHoc} from '../common-adapters'
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import AddPeopleDialog from './add-people/container'
import InviteByEmailDialog from './invite-by-email/container'
import NewTeamDialog from './new-team/container'
import JoinTeamDialog from './join-team/container'
import ManageChannels from '../chat/manage-channels/container'
import EditChannel from '../chat/manage-channels/edit-channel-container'
import EditTeamDescription from './edit-team-description/container'
import CreateChannel from '../chat/create-channel/container'
import ReallyLeaveTeam from './really-leave-team/container'
import RolePicker from './role-picker/container'
import ControlledRolePicker from './role-picker/controlled-container'
import Member from './team/member/container'
import ReallyRemoveMember from './team/really-remove-member/container'
import Team from './team/container'
import RetentionWarning from './team/settings-tab/retention/warning/container'
import {isMobile} from '../constants/platform'

const makeManageChannels = {
  manageChannels: {
    component: ManageChannels,
    tags: makeLeafTags({hideStatusBar: true, layerOnTop: !isMobile}),
    children: {
      editChannel: {
        component: MaybePopupHoc(false)(EditChannel),
        tags: makeLeafTags({hideStatusBar: true, layerOnTop: !isMobile}),
        children: {},
      },
    },
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
const reallyRemoveMember = {
  children: {},
  component: ReallyRemoveMember,
  tags: makeLeafTags({layerOnTop: !isMobile}),
}

const showNewTeamDialog = {
  children: {},
  component: NewTeamDialog,
  tags: makeLeafTags({layerOnTop: !isMobile}),
}

const makeAddPeopleOptions = {
  addPeople: {
    children: {controlledRolePicker},
    component: AddPeopleDialog,
    tags: makeLeafTags({layerOnTop: !isMobile}),
  },
  inviteByEmail: {
    children: {controlledRolePicker},
    component: InviteByEmailDialog,
    tags: makeLeafTags({layerOnTop: !isMobile}),
  },
}

const retentionWarning = {
  component: RetentionWarning,
  children: {},
  tags: makeLeafTags({layerOnTop: !isMobile}),
}

const teamRoute = makeRouteDefNode({
  children: {
    ...makeManageChannels,
    ...makeAddPeopleOptions,
    controlledRolePicker,
    rolePicker,
    reallyLeaveTeam,
    reallyRemoveMember,
    retentionWarning,
    showNewTeamDialog,
    team: () => teamRoute,
    member: {
      children: {
        rolePicker,
        reallyLeaveTeam,
        reallyRemoveMember,
      },
      component: Member,
    },
    editTeamDescription: {
      children: {},
      component: MaybePopupHoc(true)(EditTeamDescription),
      tags: makeLeafTags({layerOnTop: !isMobile}),
    },
  },
  component: Team,
})

const routeTree = makeRouteDefNode({
  children: {
    ...makeManageChannels,
    showNewTeamDialog,
    showJoinTeamDialog: {
      children: {},
      component: JoinTeamDialog,
      tags: makeLeafTags({layerOnTop: !isMobile}),
    },
    team: teamRoute,
  },
  component: TeamsContainer,
  tags: makeLeafTags({title: 'Teams'}),
})

export default routeTree
