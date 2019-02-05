// @flow
import * as React from 'react'
import * as Kb from '../common-adapters'
import * as I from 'immutable'
import * as FsGen from '../actions/fs-gen'
import * as FsTypes from '../constants/types/fs'
import * as GregorGen from '../actions/gregor-gen'
import * as TeamsGen from '../actions/teams-gen'
import Teams from './main'
import openURL from '../util/open-url'
import * as RouteTreeGen from '../actions/route-tree-gen'
import {compose, isMobile, lifecycle, connect, type RouteProps} from '../util/container'
import * as Constants from '../constants/teams'
import * as WaitingConstants from '../constants/waiting'
import {type Teamname} from '../constants/types/teams'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = state => ({
  _newTeamRequests: state.teams.getIn(['newTeamRequests'], I.List()),
  _newTeams: state.teams.getIn(['newTeams'], I.Set()),
  _teamNameToIsOpen: state.teams.getIn(['teamNameToIsOpen'], I.Map()),
  _teammembercounts: state.teams.getIn(['teammembercounts'], I.Map()),
  _teamresetusers: state.teams.getIn(['teamNameToResetUsers'], I.Map()),
  loaded: !WaitingConstants.anyWaiting(state, Constants.teamsLoadedWaitingKey),
  sawChatBanner: state.teams.getIn(['sawChatBanner'], false),
  teamnames: Constants.getSortedTeamnames(state),
})

const mapDispatchToProps = (dispatch, {routePath}) => ({
  _loadTeams: () => dispatch(TeamsGen.createGetTeams()),
  onCreateTeam: () => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {},
            selected: 'showNewTeamDialog',
          },
        ],
      })
    )
  },
  onHideChatBanner: () => dispatch(GregorGen.createUpdateCategory({body: 'true', category: 'sawChatBanner'})),
  onJoinTeam: () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: ['showJoinTeamDialog']}))
  },
  onManageChat: (teamname: Teamname) =>
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'manageChannels'}]})),
  onOpenFolder: (teamname: Teamname) =>
    dispatch(
      FsGen.createOpenPathInFilesTab({path: FsTypes.stringToPath(`/keybase/team/${teamname}`), routePath})
    ),
  onReadMore: () => {
    openURL('https://keybase.io/blog/introducing-keybase-teams')
  },
  onViewTeam: (teamname: Teamname) =>
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'team'}]})),
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

class Reloadable extends React.PureComponent<{
  ...React.ElementProps<typeof Teams>,
  ...{|_loadTeams: () => void|},
}> {
  render() {
    return (
      <Kb.Reloadable
        waitingKeys={Constants.teamsLoadedWaitingKey}
        onBack={isMobile ? this.props.onBack : undefined}
        onReload={this.props._loadTeams}
        reloadOnMount={true}
        title={this.props.title}
      >
        <Teams
          loaded={this.props.loaded}
          newTeamRequests={this.props.newTeamRequests}
          newTeams={this.props.newTeams}
          sawChatBanner={this.props.sawChatBanner}
          teamNameToIsOpen={this.props.teamNameToIsOpen}
          teammembercounts={this.props.teammembercounts}
          teamnames={this.props.teamnames}
          teamresetusers={this.props.teamresetusers}
          title={this.props.title}
          onBack={this.props.onBack}
          onCreateTeam={this.props.onCreateTeam}
          onHideChatBanner={this.props.onHideChatBanner}
          onJoinTeam={this.props.onJoinTeam}
          onManageChat={this.props.onManageChat}
          onOpenFolder={this.props.onOpenFolder}
          onReadMore={this.props.onReadMore}
          onViewTeam={this.props.onViewTeam}
        />
      </Kb.Reloadable>
    )
  }
}

export default compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  lifecycle({
    componentDidMount() {
      this.props._loadTeams()
    },
  })
)(Reloadable)
