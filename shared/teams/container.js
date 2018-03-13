// @flow
import * as I from 'immutable'
import * as KBFSGen from '../actions/kbfs-gen'
import * as GregorGen from '../actions/gregor-gen'
import * as TeamsGen from '../actions/teams-gen'
import Teams from './main'
import openURL from '../util/open-url'
import {navigateAppend} from '../actions/route-tree'
import {compose, lifecycle, type TypedState, connect} from '../util/container'
import {type Teamname} from '../constants/types/teams'

const mapStateToProps = (state: TypedState) => ({
  _newTeamRequests: state.entities.getIn(['teams', 'newTeamRequests'], I.List()),
  _newTeams: state.entities.getIn(['teams', 'newTeams'], I.Set()),
  _teamNameToIsOpen: state.entities.getIn(['teams', 'teamNameToIsOpen'], I.Map()),
  _teammembercounts: state.entities.getIn(['teams', 'teammembercounts'], I.Map()),
  _teamnames: state.entities.getIn(['teams', 'teamnames'], I.Set()),
  _teamresetusers: state.entities.getIn(['teams', 'teamNameToResetUsers'], I.Map()),
  loaded: state.entities.getIn(['teams', 'loaded'], false),
  sawChatBanner: state.entities.getIn(['teams', 'sawChatBanner'], false),
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
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

const mergeProps = (stateProps, dispatchProps) => {
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
    loaded: stateProps.loaded,
    newTeamRequests: stateProps._newTeamRequests.toArray(),
    newTeams: stateProps._newTeams.toArray(),
    sawChatBanner: stateProps.sawChatBanner,
    teamNameToIsOpen: stateProps._teamNameToIsOpen.toObject(),
    teammembercounts: stateProps._teammembercounts.toObject(),
    teamnames,
    teamresetusers: stateProps._teamresetusers.toObject(),
    ...dispatchProps,
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentDidMount: function() {
      this.props._loadTeams()
    },
  })
)(Teams)
