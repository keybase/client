import * as React from 'react'
import Git, {Props as GitProps} from '.'
import * as GitGen from '../actions/git-gen'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Constants from '../constants/git'
import * as Types from '../constants/types/git'
import * as Kb from '../common-adapters'
import {anyWaiting} from '../constants/waiting'
import * as Container from '../util/container'
import sortBy from 'lodash/sortBy'
import {memoize} from '../util/memoize'
import {HeaderTitle, HeaderRightActions} from './nav-header'

type TabsStateOwnProps = Container.RouteProps<{expandedSet: Set<string>}>

type OwnProps = TabsStateOwnProps & {}

const getRepos = memoize((git: Map<string, Types.GitInfo>) =>
  sortBy([...git.values()], ['teamname', 'name']).reduce<{personals: Array<string>; teams: Array<string>}>(
    (pt, info) => {
      const target = info.teamname ? pt.teams : pt.personals
      target.push(info.id)
      return pt
    },
    {personals: [], teams: []}
  )
)

type ExtraProps = {
  _loadGit: () => void
  clearBadges: () => void
  onBack: () => void
}

const GitReloadable = (p: Omit<GitProps & ExtraProps, 'onToggleExpand'>) => {
  const {clearBadges, _loadGit, ...rest} = p

  React.useEffect(() => {
    return () => clearBadges()
  }, [clearBadges])

  return (
    <Kb.Reloadable
      waitingKeys={Constants.loadingWaitingKey}
      onBack={Container.isMobile ? p.onBack : undefined}
      onReload={_loadGit}
      reloadOnMount={true}
    >
      <Git {...rest} />
    </Kb.Reloadable>
  )
}
GitReloadable.navigationOptions = Container.isMobile
  ? {
      header: undefined,
      title: 'Git',
    }
  : {
      header: undefined,
      headerRightActions: HeaderRightActions,
      headerTitle: HeaderTitle,
      title: 'Git',
    }

const emptySet = new Set<string>()
export default Container.connect(
  (state: Container.TypedState, ownProps: OwnProps) => ({
    error: Constants.getError(state),
    initialExpandedSet: Container.getRouteProps(ownProps, 'expandedSet', emptySet),
    loading: anyWaiting(state, Constants.loadingWaitingKey),
    ...getRepos(Constants.getIdToGit(state)),
  }),
  (dispatch: Container.TypedDispatch) => ({
    _loadGit: () => dispatch(GitGen.createLoadGit()),
    clearBadges: () => dispatch(GitGen.createClearBadges()),
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
    onNewPersonalRepo: () => {
      dispatch(GitGen.createSetError({}))
      dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {isTeam: false}, selected: 'gitNewRepo'}]}))
    },
    onNewTeamRepo: () => {
      dispatch(GitGen.createSetError({}))
      dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {isTeam: true}, selected: 'gitNewRepo'}]}))
    },
    onShowDelete: (id: string) => {
      dispatch(GitGen.createSetError({}))
      dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {id}, selected: 'gitDeleteRepo'}]}))
    },
  }),
  (s, d, _: OwnProps) => ({...s, ...d})
)(GitReloadable)
