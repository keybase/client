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

// share some between headerRightActions on desktop and component on mobile
const headerActions = (dispatch: Container.TypedDispatch, ownProps: OwnProps) => ({
  onCreateTeam: () => {
    dispatch(
      ownProps.safeNavigateAppendPayload({
        path: [{props: {}, selected: 'teamNewTeamDialog'}],
      })
    )
  },
  onJoinTeam: () => {
    dispatch(ownProps.safeNavigateAppendPayload({path: ['teamJoinTeamDialog']}))
  },
})
const makeTeamToRequest = memoize(tr =>
  tr.reduce((map, team) => {
    map[team] = (map[team] !== null && map[team] !== undefined ? map[team] : 0) + 1
    return map
  }, {})
)

class Reloadable extends React.PureComponent<Props & {loadTeams: () => void; onClearBadges: () => void}> {
  static navigationOptions = {
    header: undefined,
    headerRightActions: () => <ConnectedHeaderRightActions />,
    title: 'Teams',
  }

  private onWillBlur = () => {
    this.props.onClearBadges()
  }
  private onDidFocus = () => {
    this.props.loadTeams()
  }
  componentWillUnmount() {
    this.onWillBlur()
  }
  componentDidMount() {
    this.onDidFocus()
  }
  render() {
    const {loadTeams, ...rest} = this.props
    return (
      <Kb.Reloadable
        waitingKeys={Constants.teamsLoadedWaitingKey}
        onBack={Container.isMobile ? this.props.onBack : undefined}
        onReload={loadTeams}
        reloadOnMount={true}
        title={this.props.title}
      >
        {Container.isMobile && (
          <Kb.NavigationEvents onDidFocus={this.onDidFocus} onWillBlur={this.onWillBlur} />
        )}
        <Teams {...rest} />
      </Kb.Reloadable>
    )
  }
}

const Connected = Container.withSafeNavigation(
  Container.connect(
    (state: Container.TypedState) => ({
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
    }),
    (dispatch: Container.TypedDispatch, ownProps: OwnProps) => ({
      ...headerActions(dispatch, ownProps),
      loadTeams: () => dispatch(TeamsGen.createGetTeams()),
      onClearBadges: () => dispatch(TeamsGen.createClearNavBadges()),
      onHideChatBanner: () =>
        dispatch(GregorGen.createUpdateCategory({body: 'true', category: 'sawChatBanner'})),
      onManageChat: (teamname: Teamname) =>
        dispatch(
          ownProps.safeNavigateAppendPayload({path: [{props: {teamname}, selected: 'chatManageChannels'}]})
        ),
      onOpenFolder: (teamname: Teamname) =>
        dispatch(
          FsConstants.makeActionForOpenPathInFilesTab(FsTypes.stringToPath(`/keybase/team/${teamname}`))
        ),
      onReadMore: () => {
        openURL('https://keybase.io/blog/introducing-keybase-teams')
      },
      onViewTeam: (teamname: Teamname) =>
        dispatch(ownProps.safeNavigateAppendPayload({path: [{props: {teamname}, selected: 'team'}]})),
    }),

    (stateProps, dispatchProps, _: OwnProps) => ({
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
    })
  )(Reloadable)
)

const ConnectedHeaderRightActions = Container.compose(
  Container.withSafeNavigation,
  Container.connect(() => ({}), headerActions, (s, d, o) => ({...o, ...s, ...d}))
)(HeaderRightActions as any)

export default Connected
