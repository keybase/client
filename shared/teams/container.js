// @flow
import * as React from 'react'
import * as Kb from '../common-adapters'
import * as I from 'immutable'
import * as FsGen from '../actions/fs-gen'
import * as FsTypes from '../constants/types/fs'
import * as GregorGen from '../actions/gregor-gen'
import * as TeamsGen from '../actions/teams-gen'
import * as Styles from '../styles'
import Teams from './main'
import {HeaderRightActions} from './main/header'
import openURL from '../util/open-url'
import * as RouteTreeGen from '../actions/route-tree-gen'
import {compose, isMobile, lifecycle, connect, type RouteProps} from '../util/container'
import * as Constants from '../constants/teams'
import * as WaitingConstants from '../constants/waiting'
import {type Teamname} from '../constants/types/teams'
import {memoize} from '../util/memoize'
import flags from '../util/feature-flags'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = state => ({
  _newTeamRequests: state.teams.getIn(['newTeamRequests'], I.List()),
  _newTeams: state.teams.getIn(['newTeams'], I.Set()),
  _teamNameToIsOpen: state.teams.getIn(['teamNameToIsOpen'], I.Map()),
  _teamNameToRole: state.teams.getIn(['teamNameToRole'], I.Map()),
  _teammembercounts: state.teams.getIn(['teammembercounts'], I.Map()),
  _teamresetusers: state.teams.getIn(['teamNameToResetUsers'], I.Map()),
  loaded: !WaitingConstants.anyWaiting(state, Constants.teamsLoadedWaitingKey),
  sawChatBanner: state.teams.getIn(['sawChatBanner'], false),
  teamnames: Constants.getSortedTeamnames(state),
})

// share some between headerRightActions on desktop and component on mobile
const headerActions = dispatch => ({
  onCreateTeam: () => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {}, selected: 'showNewTeamDialog'}],
      })
    )
  },
  onJoinTeam: () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: ['showJoinTeamDialog']}))
  },
})
const mapDispatchToProps = (dispatch, {routePath}) => ({
  ...headerActions(dispatch),
  _loadTeams: () => dispatch(TeamsGen.createGetTeams()),
  onHideChatBanner: () => dispatch(GregorGen.createUpdateCategory({body: 'true', category: 'sawChatBanner'})),
  onManageChat: (teamname: Teamname) =>
    dispatch(
      RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'chatManageChannels'}]})
    ),
  onOpenFolder: (teamname: Teamname) =>
    dispatch(
      FsGen.createOpenPathInFilesTab({
        path: FsTypes.stringToPath(`/keybase/team/${teamname}`),
        routePath: flags.useNewRouter ? undefined : routePath,
      })
    ),
  onReadMore: () => {
    openURL('https://keybase.io/blog/introducing-keybase-teams')
  },
  onViewTeam: (teamname: Teamname) =>
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'team'}]})),
})

const makeTeamToRequest = memoize(tr =>
  tr.reduce((map, team) => {
    map[team] = (map[team] ?? 0) + 1
    return map
  }, {})
)

const mergeProps = (stateProps, dispatchProps) => {
  return {
    loaded: stateProps.loaded,
    newTeams: stateProps._newTeams.toArray(),
    sawChatBanner: stateProps.sawChatBanner,
    teamNameToCanManageChat: stateProps._teamNameToRole.map(role => role !== 'none').toObject(),
    teamNameToIsOpen: stateProps._teamNameToIsOpen.toObject(),
    teamToRequest: makeTeamToRequest(stateProps._newTeamRequests),
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
    const {_loadTeams, ...rest} = this.props
    return (
      <Kb.Reloadable
        waitingKeys={Constants.teamsLoadedWaitingKey}
        onBack={isMobile ? this.props.onBack : undefined}
        onReload={_loadTeams}
        reloadOnMount={true}
        title={this.props.title}
      >
        <Teams {...rest} />
      </Kb.Reloadable>
    )
  }
}

const Connected = compose(
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

const ConnectedHeaderRightActions = connect<{}, _, _, _, _>(
  () => ({}),
  headerActions,
  (s, d, o) => ({...o, ...s, ...d})
)(HeaderRightActions)

// $FlowIssue lets fix this
Connected.navigationOptions = {
  header: undefined,
  headerRightActions: () => <ConnectedHeaderRightActions />,
  headerTitle: () => (
    <Kb.Text type="Header" style={{marginLeft: Styles.globalMargins.xsmall}}>
      Teams
    </Kb.Text>
  ),
  title: 'Teams',
}

export default Connected
