// @flow
import {isMobile} from '../constants/platform'
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import {MaybePopupHoc} from '../common-adapters'

const routeTree = () => {
  const TeamsContainer = require('./container').default
  const AddPeopleDialog = require('./add-people/container').default
  const InviteByEmailDialog = require('./invite-by-email/container').default
  const NewTeamDialog = require('./new-team/container').default
  const JoinTeamDialog = require('./join-team/container').default
  const ManageChannels = require('../chat/manage-channels/container').default
  const EditChannel = require('../chat/manage-channels/edit-channel-container').default
  const EditTeamAvatar = require('../profile/edit-avatar/container').default
  const EditTeamDescription = require('./edit-team-description/container').default
  const CreateChannel = require('../chat/create-channel/container').default
  const ReallyLeaveTeam = require('./really-leave-team/container').default
  const Member = require('./team/member/container').default
  const ReallyRemoveMember = require('./team/really-remove-member/container').default
  const Team = require('./team/container').default
  const RetentionWarning = require('./team/settings-tab/retention/warning/container').default
  const RenameTeam = require('./rename-team/container').default
  const makeManageChannels = {
    chatCreateChannel: {
      children: {},
      component: CreateChannel,
      tags: makeLeafTags({hideStatusBar: true, layerOnTop: !isMobile}),
    },
    chatManageChannels: {
      children: {
        chatEditChannel: {
          children: {},
          component: MaybePopupHoc(false)(EditChannel),
          tags: makeLeafTags({hideStatusBar: true, layerOnTop: !isMobile}),
        },
      },
      component: ManageChannels,
      tags: makeLeafTags({hideStatusBar: true, layerOnTop: !isMobile}),
    },
  }

  const teamReallyLeaveTeam = {
    children: {},
    component: ReallyLeaveTeam,
    tags: makeLeafTags({layerOnTop: !isMobile}),
  }
  const teamReallyRemoveMember = {
    children: {},
    component: ReallyRemoveMember,
    tags: makeLeafTags({layerOnTop: !isMobile}),
  }

  const teamNewTeamDialog = {
    children: {},
    component: NewTeamDialog,
    tags: makeLeafTags({layerOnTop: !isMobile}),
  }

  const makeAddPeopleOptions = {
    teamAddPeople: {
      children: {},
      component: AddPeopleDialog,
      tags: makeLeafTags({layerOnTop: !isMobile}),
    },
    teamInviteByEmail: {
      children: {},
      component: InviteByEmailDialog,
      tags: makeLeafTags({layerOnTop: !isMobile}),
    },
  }

  const retentionWarning = {
    children: {},
    component: RetentionWarning,
    tags: makeLeafTags({layerOnTop: !isMobile}),
  }

  const teamRoute = makeRouteDefNode({
    children: {
      ...makeManageChannels,
      ...makeAddPeopleOptions,
      retentionWarning,
      team: () => teamRoute,
      teamEditTeamAvatar: {
        component: EditTeamAvatar,
        tags: makeLeafTags({layerOnTop: !isMobile}),
      },
      teamEditTeamDescription: {
        children: {},
        component: MaybePopupHoc(true)(EditTeamDescription),
        tags: makeLeafTags({layerOnTop: !isMobile}),
      },
      teamMember: {
        children: {
          teamReallyLeaveTeam,
          teamReallyRemoveMember,
        },
        component: Member,
      },
      teamNewTeamDialog,
      teamReallyLeaveTeam,
      teamReallyRemoveMember,
      teamRename: {
        component: RenameTeam,
        tags: makeLeafTags({layerOnTop: !isMobile}),
      },
    },
    component: Team,
  })
  return makeRouteDefNode({
    children: {
      ...makeManageChannels,
      team: teamRoute,
      teamJoinTeamDialog: {
        children: {},
        component: JoinTeamDialog,
        tags: makeLeafTags({layerOnTop: !isMobile}),
      },
      teamNewTeamDialog,
    },
    component: TeamsContainer,
    tags: makeLeafTags({title: 'Teams'}),
  })
}

export default routeTree

export const newRoutes = {
  'tabs.teamsTab': {getScreen: () => require('./container').default, upgraded: true},
  team: {getScreen: () => require('./team/container').default, upgraded: true},
  teamMember: {getScreen: () => require('./team/member/container').default, upgraded: true},
}

export const newModalRoutes = {
  retentionWarning: {
    getScreen: () => require('./team/settings-tab/retention/warning/container').default,
    upgraded: true,
  },
  teamAddPeople: {getScreen: () => require('./add-people/container').default, upgraded: true},
  teamEditTeamAvatar: {getScreen: () => require('../profile/edit-avatar/container').default, upgraded: true},
  teamEditTeamDescription: {
    getScreen: () => MaybePopupHoc(true)(require('./edit-team-description/container').default),
    upgraded: true,
  },
  teamInviteByEmail: {getScreen: () => require('./invite-by-email/container').default, upgraded: true},
  teamJoinTeamDialog: {getScreen: () => require('./join-team/container').default, upgraded: true},
  teamNewTeamDialog: {getScreen: () => require('./new-team/container').default, upgraded: true},
  teamReallyLeaveTeam: {getScreen: () => require('./really-leave-team/container').default, upgraded: true},
  teamReallyRemoveMember: {
    getScreen: () => require('./team/really-remove-member/container').default,
    upgraded: true,
  },
  teamRename: {
    getScreen: () => require('./rename-team/container').default,
    upgraded: true,
  },
}
