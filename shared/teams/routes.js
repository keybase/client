// @flow
import TeamsContainer from './container'
<<<<<<< 58714253fe6ea1a3620dce25eaa44454d21e55d6
import AddPeopleDialog from './add-people/container'
||||||| merged common ancestors
=======
import {MaybePopupHoc} from '../common-adapters'
>>>>>>> Add wiring for open team settings
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import NewTeamDialog from './new-team/container'
import JoinTeamDialog from './join-team/container'
import ManageChannels from '../chat/manage-channels/container'
import CreateChannel from '../chat/create-channel/container'
import ReallyLeaveTeam from './really-leave-team/container'
import RolePicker from './role-picker/container'
import Member from './team/member/container'
import ReallyRemoveMember from './team/really-remove-member/container'
import Team from './team/container'
import {ConnectedMakeOpenTeamConfirm, ConnectedMakeTeamClosed} from './open-team/container'
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
const makeRolePicker = {
  rolePicker: {
    children: {},
    component: RolePicker,
    tags: makeLeafTags({layerOnTop: !isMobile}),
  },
}
const makeReallyLeaveTeam = {
  reallyLeaveTeam: {
    children: {},
    component: ReallyLeaveTeam,
    tags: makeLeafTags({layerOnTop: !isMobile}),
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
        ...makeManageChannels,
        ...makeRolePicker,
        ...makeReallyLeaveTeam,
        openTeamSetting: {
          children: {},
          component: MaybePopupHoc(ConnectedMakeOpenTeamConfirm),
          tags: makeLeafTags({layerOnTop: !isMobile}),
        },
        openCloseTeamSetting: {
          children: {},
          component: MaybePopupHoc(ConnectedMakeTeamClosed),
          tags: makeLeafTags({layerOnTop: !isMobile}),
        },
        member: {
          children: {
            ...makeRolePicker,
            ...makeReallyLeaveTeam,

            reallyRemoveMember: {
              children: {},
              component: ReallyRemoveMember,
              tags: makeLeafTags({layerOnTop: !isMobile}),
            },
          },
          component: Member,
        },
        addPeople: {
          children: {},
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
