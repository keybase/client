// @flow
import * as I from 'immutable'
import * as KBFSGen from '../actions/kbfs-gen'
import * as GregorGen from '../actions/gregor-gen'
import Teams from './main'
import openURL from '../util/open-url'
import {getTeams} from '../actions/teams/creators'
import {navigateAppend} from '../actions/route-tree'
import {compose, lifecycle, type TypedState, pausableConnect} from '../util/container'
import {type Teamname} from '../constants/types/teams'

type StateProps = {
  _teamnames: I.Set<Teamname>,
  _teammembercounts: I.Map<Teamname, number>,
  sawChatBanner: boolean,
  loaded: boolean,
  _newTeams: I.Set<string>,
  _newTeamRequests: I.List<string>,
}

const mapStateToProps = (state: TypedState): StateProps => {
  const teamnames = state.entities.getIn(['teams', 'teamnames'], I.Set())
  const teammembercounts = state.entities.getIn(['teams', 'teammembercounts'], I.Map())
  const loaded = state.entities.getIn(['teams', 'loaded'], false)
  const newTeams = state.entities.getIn(['teams', 'newTeams'], I.Set())
  const newTeamRequests = state.entities.getIn(['teams', 'newTeamRequests'], I.List())
  return {
    _teamnames: teamnames,
    _teammembercounts: teammembercounts,
    sawChatBanner: state.entities.getIn(['teams', 'sawChatBanner'], false),
    loaded,
    _newTeams: newTeams,
    _newTeamRequests: newTeamRequests,
  }
}

type DispatchProps = {
  onCreateTeam: () => void,
  onHideBanner: () => void,
  onJoinTeam: () => void,
  onManageChat: (teamname: Teamname) => void,
  onOpenFolder: (teamname: Teamname) => void,
  onReadMore: () => void,
  onViewTeam: (teamname: Teamname) => void,
}

const mapDispatchToProps = (dispatch: Dispatch): DispatchProps => ({
  _loadTeams: () => dispatch(getTeams()),
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
  onHideBanner: () => dispatch(GregorGen.createInjectItem({category: 'sawChatBanner', body: 'true'})),
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
