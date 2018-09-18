// @flow
import * as I from 'immutable'
import * as KBFSGen from '../actions/kbfs-gen'
import * as GregorGen from '../actions/gregor-gen'
import * as TeamsGen from '../actions/teams-gen'
import Teams from './main'
import openURL from '../util/open-url'
import {navigateAppend} from '../actions/route-tree'
import {compose, lifecycle, type TypedState, connect} from '../util/container'
import {getSortedTeamnames} from '../constants/teams'
import {type Teamname} from '../constants/types/teams'

const mapStateToProps = (state: TypedState) => ({
  _newTeamRequests: state.teams.getIn(['newTeamRequests'], I.List()),
  _newTeams: state.teams.getIn(['newTeams'], I.Set()),
  _teamNameToIsOpen: state.teams.getIn(['teamNameToIsOpen'], I.Map()),
  _teammembercounts: state.teams.getIn(['teammembercounts'], I.Map()),
  _teamresetusers: state.teams.getIn(['teamNameToResetUsers'], I.Map()),
  loaded: state.teams.getIn(['loaded'], false),
  sawChatBanner: state.teams.getIn(['sawChatBanner'], false),
  teamnames: getSortedTeamnames(state),
})

const mapDispatchToProps = (dispatch) => ({
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
  onHideChatBanner: () => dispatch(GregorGen.createUpdateCategory({body: 'true', category: 'sawChatBanner'})),
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
  return {
    loaded: stateProps.loaded,
    newTeamRequests: stateProps._newTeamRequests.toArray(),
    newTeams: stateProps._newTeams.toArray(),
    sawChatBanner: stateProps.sawChatBanner,
    teamNameToIsOpen: stateProps._teamNameToIsOpen.toObject(),
    teammembercounts: stateProps._teammembercounts.toObject(),
    teamnames: stateProps.teamnames,
    teamresetusers: stateProps._teamresetusers.toObject(),
    ...dispatchProps,
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentDidMount() {
      this.props._loadTeams()
    },
  })
)(Teams)
