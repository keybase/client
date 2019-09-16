import * as React from 'react'
import Git, {Props as GitProps} from '.'
import * as GitGen from '../actions/git-gen'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Constants from '../constants/git'
import * as Types from '../constants/types/git'
import * as Kb from '../common-adapters'
import {anyWaiting} from '../constants/waiting'
import * as Container from '../util/container'
import {sortBy} from 'lodash-es'
import {memoize} from '../util/memoize'
import {HeaderTitle, HeaderRightActions} from './nav-header'

type OwnProps = {}

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

// keep track in the module
let moduleExpandedSet = new Set<string>()

const GitReloadable = (p: Omit<GitProps & ExtraProps, 'expandedSet' | 'onToggleExpand'>) => {
  const {clearBadges} = p
  const [expandedSet, setExpandedSet] = React.useState(moduleExpandedSet)

  React.useEffect(() => {
    moduleExpandedSet = expandedSet
    return () => clearBadges()
  }, [expandedSet, clearBadges])

  const toggleExpand = (id: string) => {
    moduleExpandedSet.has(id) ? moduleExpandedSet.delete(id) : moduleExpandedSet.add(id)
    setExpandedSet(new Set(moduleExpandedSet))
  }

  const {_loadGit, ...rest} = p
  return (
    <Kb.Reloadable
      waitingKeys={Constants.loadingWaitingKey}
      onBack={Container.isMobile ? p.onBack : undefined}
      onReload={_loadGit}
      reloadOnMount={true}
    >
      <Git expandedSet={expandedSet} onToggleExpand={toggleExpand} {...rest} />
    </Kb.Reloadable>
  )
}
GitReloadable.navigationOptions = Container.isMobile
  ? undefined
  : {
      header: undefined,
      headerRightActions: HeaderRightActions,
      headerTitle: HeaderTitle,
      title: 'Git',
    }

export default Container.connect(
  (state: Container.TypedState) => ({
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
