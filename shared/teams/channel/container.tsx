import * as React from 'react'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import CustomTitle from './custom-title/container'
import {HeaderRightActions, HeaderTitle, SubHeader} from './nav-header/container'
import * as Kb from '../../common-adapters'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'
import Channel, {Sections} from '.'
import makeRows from './rows'
import flags from '../../util/feature-flags'

type OwnProps = Container.RouteProps<{teamID: Types.TeamID; initialTab?: Types.TabKey}>

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => {
  const teamID = Container.getRouteProps(ownProps, 'teamID', '')
  if (!teamID) {
    throw new Error('There was a problem loading the team page, please report this error.')
  }

  return {
    channelInfos: state.teams.teamIDToChannelInfos.get(teamID),
    invitesCollapsed: state.teams.invitesCollapsed,
    subteamsFiltered: state.teams.subteamsFiltered,
    teamDetails: Constants.getTeamDetails(state, teamID),
    teamID,
    teamMeta: Constants.getTeamMeta(state, teamID),
    yourOperations: Constants.getCanPerformByID(state, teamID),
    yourUsername: state.config.username,
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
})

const Connected = Container.compose(
  Container.connect(mapStateToProps, mapDispatchToProps, (stateProps, dispatchProps, _: OwnProps) => {
    const rows = makeRows(
      stateProps.teamMeta,
      stateProps.teamDetails,
      stateProps.yourUsername,
      stateProps.yourOperations,
      stateProps.invitesCollapsed,
      stateProps.channelInfos,
      stateProps.subteamsFiltered
    )
    const sections: Sections = [
      ...(Container.isMobile && !flags.teamsRedesign
        ? [{data: [{key: 'header-inner', type: 'header' as const}], key: 'header'}]
        : []),
      {data: rows, header: {key: 'tabs', type: 'tabs'}, key: 'body'},
    ]
    const customComponent = <CustomTitle teamID={stateProps.teamID} />
    return {
      customComponent,
      onBack: dispatchProps.onBack,
      rows,
      sections,
      teamID: stateProps.teamID,
    }
  }),
  Kb.HeaderHoc
)(Channel) as any

Connected.navigationOptions = (ownProps: OwnProps) => ({
  header:
    Container.isMobile && flags.teamsRedesign
      ? () => <HeaderTitle teamID={Container.getRouteProps(ownProps, 'teamID', '')} />
      : null,
  headerExpandable: true,
  headerHideBorder: true,
  headerRightActions:
    Container.isMobile || flags.teamsRedesign
      ? undefined
      : () => <HeaderRightActions teamID={Container.getRouteProps(ownProps, 'teamID', '')} />,
  headerTitle: Container.isMobile
    ? undefined
    : () => <HeaderTitle teamID={Container.getRouteProps(ownProps, 'teamID', '')} />,
  subHeader:
    Container.isMobile && !flags.teamsRedesign
      ? undefined
      : () => <SubHeader teamID={Container.getRouteProps(ownProps, 'teamID', '')} />,
})

export default Connected
export type ChannelScreenType = React.ComponentType<OwnProps>
