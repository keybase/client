import * as Constants from '../constants/git'
import * as Container from '../util/container'
import * as GitGen from '../actions/git-gen'
import * as Kb from '../common-adapters'
import * as React from 'react'
import * as RouteTreeGen from '../actions/route-tree-gen'
import Git, {type Props as GitProps} from '.'
import sortBy from 'lodash/sortBy'
import type * as Types from '../constants/types/git'
import {HeaderTitle, HeaderRightActions} from './nav-header'
import {anyWaiting} from '../constants/waiting'
import {memoize} from '../util/memoize'

type TabsStateOwnProps = Container.RouteProps<'gitRoot'>

type OwnProps = TabsStateOwnProps

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
      title: 'Git',
    }
  : {
      headerRightActions: HeaderRightActions,
      headerTitle: HeaderTitle,
      title: 'Git',
    }

const emptySet = new Set<string>()
export default Container.connect(
  (state: Container.TypedState, ownProps: OwnProps) => ({
    error: Constants.getError(state),
    initialExpandedSet: ownProps.route.params?.expandedSet ?? emptySet,
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
