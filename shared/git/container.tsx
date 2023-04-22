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

  Container.useOnUnMountOnce(() => {
    clearBadges()
  })

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

export default (ownProps: OwnProps) => {
  const error = Container.useSelector(state => Constants.getError(state))
  const initialExpandedSet = ownProps.route.params?.expandedSet ?? emptySet
  const loading = Container.useSelector(state => anyWaiting(state, Constants.loadingWaitingKey))
  const repos = Container.useSelector(state => getRepos(Constants.getIdToGit(state)))

  const dispatch = Container.useDispatch()

  const _loadGit = () => {
    dispatch(GitGen.createLoadGit())
  }
  const clearBadges = () => {
    dispatch(GitGen.createClearBadges())
  }
  const onBack = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const onNewPersonalRepo = () => {
    dispatch(GitGen.createSetError({}))
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {isTeam: false}, selected: 'gitNewRepo'}]}))
  }
  const onNewTeamRepo = () => {
    dispatch(GitGen.createSetError({}))
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {isTeam: true}, selected: 'gitNewRepo'}]}))
  }
  const onShowDelete = (id: string) => {
    dispatch(GitGen.createSetError({}))
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {id}, selected: 'gitDeleteRepo'}]}))
  }
  const props = {
    ...repos,
    _loadGit,
    clearBadges,
    error,
    initialExpandedSet,
    loading,
    onBack,
    onNewPersonalRepo,
    onNewTeamRepo,
    onShowDelete,
    repos,
  }
  return <GitReloadable {...props} />
}
