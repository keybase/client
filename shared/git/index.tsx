import * as Constants from '../constants/git'
import * as Container from '../util/container'
import * as GitGen from '../actions/git-gen'
import * as Kb from '../common-adapters'
import * as React from 'react'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Styles from '../styles'
import Row from './row'
import sortBy from 'lodash/sortBy'
import type * as Types from '../constants/types/git'
import {HeaderTitle, HeaderRightActions} from './nav-header'
import {anyWaiting} from '../constants/waiting'
import {memoize} from '../util/memoize'
import {union} from '../util/set'

type OwnProps = Container.RouteProps2<'gitRoot'>

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

const GitReloadable = (p: Omit<Props & ExtraProps, 'onToggleExpand'>) => {
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

export const options = Container.isMobile
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
  const initialExpandedSet = ownProps.route.params?.expandedSet ?? emptySet
  const error = Container.useSelector(state => Constants.getError(state))
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

type Props = {
  error?: Error
  loading: boolean
  initialExpandedSet?: Set<string>
  onShowDelete: (id: string) => void
  onNewPersonalRepo: () => void
  onNewTeamRepo: () => void
  personals: Array<string>
  teams: Array<string>
}

// keep track in the module
let moduleExpandedSet = new Set<string>()

const Git = (props: Props) => {
  const {error, loading, personals, teams, initialExpandedSet} = props
  const {onShowDelete, onNewPersonalRepo, onNewTeamRepo} = props

  const [expandedSet, setExpandedSet] = React.useState(
    new Set<string>(union(initialExpandedSet ?? new Set(), moduleExpandedSet))
  )

  React.useEffect(() => {
    moduleExpandedSet = expandedSet
  }, [expandedSet])

  const toggleExpand = (id: string) => {
    moduleExpandedSet.has(id) ? moduleExpandedSet.delete(id) : moduleExpandedSet.add(id)
    setExpandedSet(new Set(moduleExpandedSet))
  }

  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, toggleShowingPopup} = p
      const menuItems = [
        {icon: 'iconfont-person', onClick: onNewPersonalRepo, title: 'New personal repository'} as const,
        {icon: 'iconfont-people', onClick: onNewTeamRepo, title: 'New team repository'} as const,
      ]

      return (
        <Kb.FloatingMenu
          attachTo={attachTo}
          closeOnSelect={true}
          items={menuItems}
          onHidden={toggleShowingPopup}
          visible={true}
          position="bottom center"
        />
      )
    },
    [onNewPersonalRepo, onNewTeamRepo]
  )
  const {toggleShowingPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container}>
      {!!error && <Kb.Banner color="red">{error.message}</Kb.Banner>}
      {Styles.isMobile && (
        <Kb.ClickableBox ref={popupAnchor} style={styles.header} onClick={toggleShowingPopup}>
          <Kb.Icon
            type="iconfont-new"
            style={{marginRight: Styles.globalMargins.tiny}}
            color={Styles.globalColors.blue}
            fontSize={Styles.isMobile ? 20 : 16}
          />
          <Kb.Text type="BodyBigLink">New encrypted git repository...</Kb.Text>
        </Kb.ClickableBox>
      )}
      <Kb.SectionList
        keyExtractor={item => item}
        sectionKeyExtractor={section => section.title}
        extraData={expandedSet}
        renderItem={({item}) => (
          <Row
            key={item}
            expanded={expandedSet.has(item)}
            id={item}
            onShowDelete={onShowDelete}
            onToggleExpand={toggleExpand}
          />
        )}
        renderSectionHeader={({section}) => (
          <Kb.SectionDivider label={section.title} showSpinner={section.loading} />
        )}
        sections={[
          {data: personals, loading: loading, title: 'Personal'},
          {data: teams, loading: loading, title: 'Team'},
        ]}
      />
      {popup}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {position: 'relative'},
      header: {
        ...Styles.globalStyles.flexBoxCenter,
        ...Styles.globalStyles.flexBoxRow,
        flexShrink: 0,
        height: 48,
      },
    } as const)
)
