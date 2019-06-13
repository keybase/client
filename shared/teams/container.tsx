import * as React from 'react'
import * as Container from '../util/container'
import * as Kb from '../common-adapters'
import * as I from 'immutable'
import * as FsConstants from '../constants/fs'
import * as FsTypes from '../constants/types/fs'
import * as GregorGen from '../actions/gregor-gen'
import * as TeamsGen from '../actions/teams-gen'
import Teams, {Props} from './main'
import {HeaderRightActions} from './main/header'
import openURL from '../util/open-url'
import * as Constants from '../constants/teams'
import * as WaitingConstants from '../constants/waiting'
import {Teamname} from '../constants/types/teams'
import {memoize} from '../util/memoize'

type OwnProps = Container.PropsWithSafeNavigation<{}>

const mapStateToProps = state => ({
  _deletedTeams: state.teams.deletedTeams,
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
const headerActions = (dispatch, {navigateAppend}) => ({
  onCreateTeam: () => {
    dispatch(
      navigateAppend({
        path: [{props: {}, selected: 'teamNewTeamDialog'}],
      })
    )
  },
  onJoinTeam: () => {
    dispatch(navigateAppend({path: ['teamJoinTeamDialog']}))
  },
})
const mapDispatchToProps = (dispatch, {navigateAppend}) => ({
  ...headerActions(dispatch, {navigateAppend}),
  _loadTeams: () => dispatch(TeamsGen.createGetTeams()),
  _onClearBadges: () => dispatch(TeamsGen.createClearNavBadges()),
  onHideChatBanner: () => dispatch(GregorGen.createUpdateCategory({body: 'true', category: 'sawChatBanner'})),
  onManageChat: (teamname: Teamname) =>
    dispatch(navigateAppend({path: [{props: {teamname}, selected: 'chatManageChannels'}]})),
  onOpenFolder: (teamname: Teamname) =>
    dispatch(FsConstants.makeActionForOpenPathInFilesTab(FsTypes.stringToPath(`/keybase/team/${teamname}`))),
  onReadMore: () => {
    openURL('https://keybase.io/blog/introducing-keybase-teams')
  },
  onViewTeam: (teamname: Teamname) =>
    dispatch(navigateAppend({path: [{props: {teamname}, selected: 'team'}]})),
})

const makeTeamToRequest = memoize(tr =>
  tr.reduce((map, team) => {
    map[team] = (map[team] !== null && map[team] !== undefined ? map[team] : 0) + 1
    return map
  }, {})
)

const mergeProps = (stateProps, dispatchProps) => {
  return {
    deletedTeams: stateProps._deletedTeams.toArray(),
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

class Reloadable extends React.PureComponent<Props & {_loadTeams: () => void; _onClearBadges: () => void}> {
  _onWillBlur = () => {
    this.props._onClearBadges()
  }
  _onDidFocus = () => {
    this.props._loadTeams()
  }
  componentWillUnmount() {
    this._onWillBlur()
  }
  componentDidMount() {
    this._onDidFocus()
  }
  render() {
    const {_loadTeams, ...rest} = this.props
    return (
      <Kb.Reloadable
        waitingKeys={Constants.teamsLoadedWaitingKey}
        onBack={Container.isMobile ? this.props.onBack : undefined}
        onReload={_loadTeams}
        reloadOnMount={true}
        title={this.props.title}
      >
        {Container.isMobile && (
          <Kb.NavigationEvents onDidFocus={this._onDidFocus} onWillBlur={this._onWillBlur} />
        )}
        <Teams {...rest} />
      </Kb.Reloadable>
    )
  }
}

const Connected = Container.compose(
  Container.withSafeNavigation,
  Container.connect(mapStateToProps, mapDispatchToProps, mergeProps)
)(Reloadable)

const ConnectedHeaderRightActions = Container.compose(
  Container.withSafeNavigation,
  Container.connect(() => ({}), headerActions, (s, d, o) => ({...o, ...s, ...d}))
)(HeaderRightActions as any)

// @ts-ignore TODO fix
Connected.navigationOptions = {
  header: undefined,
  headerRightActions: () => <ConnectedHeaderRightActions />,
  title: 'Teams',
}

export default Connected
