import * as React from 'react'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {HeaderRightActions, HeaderTitle, SubHeader} from './nav-header/container'
import * as Kb from '../../common-adapters'
import * as Container from '../../util/container'
import * as Types from '../../constants/types/teams'
import Team from '.'
import flags from '../../util/feature-flags'

type OwnProps = Container.RouteProps<{teamID: Types.TeamID; initialTab?: Types.TabKey}>

// TODO: when the teamsRedesign flag is removed, get rid of this connector entirely and
// move the route prop handling and the navigation options into index.tsx
const maybeHeaderHoc = flags.teamsRedesign ? a => a : Kb.HeaderHoc
const Connected = Container.compose(
  Container.connect(
    () => ({}),
    (dispatch: Container.TypedDispatch) => ({
      onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
    }),
    (_, d, ownProps: OwnProps) => {
      const teamID = Container.getRouteProps(ownProps, 'teamID', Types.noTeamID)
      const initialTab = Container.getRouteProps(ownProps, 'initialTab', undefined)
      return {
        ...d,
        initialTab,
        teamID,
      }
    }
  ),
  maybeHeaderHoc
)(Team)

const newNavigationOptions = () => ({
  headerHideBorder: true,
})

// @ts-ignore until the compose situation above can go away
Connected.navigationOptions = flags.teamsRedesign
  ? newNavigationOptions
  : (ownProps: OwnProps) => ({
      header: null,
      headerExpandable: true,
      headerHideBorder: true,
      headerRightActions: Container.isMobile
        ? undefined
        : () => <HeaderRightActions teamID={Container.getRouteProps(ownProps, 'teamID', '')} />,
      headerTitle: Container.isMobile
        ? undefined
        : () => <HeaderTitle teamID={Container.getRouteProps(ownProps, 'teamID', '')} />,
      subHeader: Container.isMobile
        ? undefined
        : () => <SubHeader teamID={Container.getRouteProps(ownProps, 'teamID', '')} />,
    })

export default Connected
