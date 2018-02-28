// @flow
import * as I from 'immutable'
import * as KBFSGen from '../actions/kbfs-gen'
import * as GregorGen from '../actions/gregor-gen'
import * as TeamsGen from '../actions/teams-gen'
import Teams from './main'
import openURL from '../util/open-url'
import {navigateAppend} from '../actions/route-tree'
import {compose, lifecycle, type TypedState, pausableConnect} from '../util/container'
import {type Teamname, type ResetUser} from '../constants/types/teams'

type StateProps = {
  _teamnames: I.Set<Teamname>,
  _teammembercounts: I.Map<Teamname, number>,
  _teamresetusers: I.Map<Teamname, I.Set<ResetUser>>,
  sawChatBanner: boolean,
  loaded: boolean,
  _newTeams: I.Set<string>,
  _newTeamRequests: I.List<string>,
  _teamNameToIsOpen: I.Map<Teamname, boolean>,
}

const mapStateToProps = (state: TypedState): StateProps => {
  const teamnames = state.entities.getIn(['teams', 'teamnames'], I.Set())
  const teammembercounts = state.entities.getIn(['teams', 'teammembercounts'], I.Map())
  const teamNameToIsOpen = state.entities.getIn(['teams', 'teamNameToIsOpen'], I.Map())
  const loaded = state.entities.getIn(['teams', 'loaded'], false)
  const newTeams = state.entities.getIn(['teams', 'newTeams'], I.Set())
  const newTeamRequests = state.entities.getIn(['teams', 'newTeamRequests'], I.List())
  const teamresetusers = state.entities.getIn(['teams', 'teamNameToResetUsers'], I.Map())
  return {
    _teamnames: teamnames,
    _teammembercounts: teammembercounts,
    _teamresetusers: teamresetusers,
    _teamNameToIsOpen: teamNameToIsOpen,
    sawChatBanner: state.entities.getIn(['teams', 'sawChatBanner'], false),
    loaded,
    _newTeams: newTeams,
    _newTeamRequests: newTeamRequests,
  }
}

type DispatchProps = {
  onCreateTeam: () => void,
  onHideChatBanner: () => void,
  onJoinTeam: () => void,
  onManageChat: (teamname: Teamname) => void,
  onOpenFolder: (teamname: Teamname) => void,
  onReadMore: () => void,
  onViewTeam: (teamname: Teamname) => void,
}

const mapDispatchToProps = (dispatch: Dispatch): DispatchProps => ({
  _loadTeams: () => dispatch(TeamsGen.createGetTeams()),
  onCreateTeam: () => {
    dispatch(
      navigateAppend([
        {
          props: {},
          selected: 'showNewTeamDialog',
        },
      ])
    )
  },
  onHideChatBanner: () => dispatch(GregorGen.createInjectItem({category: 'sawChatBanner', body: 'true'})),
  onJoinTeam: () => {
    dispatch(navigateAppend(['showJoinTeamDialog']))
  },
  onManageChat: (teamname: Teamname) =>
    dispatch(navigateAppend([{props: {teamname}, selected: 'manageChannels'}])),
  onOpenFolder: (teamname: Teamname) => dispatch(KBFSGen.createOpen({path: `/keybase/team/${teamname}`})),
  onReadMore: () => {
    openURL('https://keybase.io/blog/introducing-keybase-teams')
  },
  onViewTeam: (teamname: Teamname) => dispatch(navigateAppend([{props: {teamname}, selected: 'team'}])),
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps) => {
  let teamnames = stateProps._teamnames.toArray()
  teamnames.sort((a, b) => {
    const aName = a.toUpperCase()
    const bName = b.toUpperCase()
    if (aName < bName) {
      return -1
    } else if (aName > bName) {
      return 1
    } else {
      return 0
    }
  })

  return {
    sawChatBanner: stateProps.sawChatBanner,
    teamnames,
    teammembercounts: stateProps._teammembercounts.toObject(),
    teamresetusers: stateProps._teamresetusers.toObject(),
    teamNameToIsOpen: stateProps._teamNameToIsOpen.toObject(),
    loaded: stateProps.loaded,
    newTeams: stateProps._newTeams.toArray(),
    newTeamRequests: stateProps._newTeamRequests.toArray(),
    ...dispatchProps,
  }
}

export default compose(
  pausableConnect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentDidMount: function() {
      this.props._loadTeams()
    },
  })
)(Teams)
