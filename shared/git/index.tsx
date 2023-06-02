import * as Constants from '../constants/git'
import * as Container from '../util/container'
import * as Kb from '../common-adapters'
import * as React from 'react'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Styles from '../styles'
import Row from './row'
import sortBy from 'lodash/sortBy'
import type * as Types from '../constants/types/git'
import {anyWaiting} from '../constants/waiting'
import {memoize} from '../util/memoize'
import {union} from '../util/set'
import {useFocusEffect} from '@react-navigation/core'

type OwnProps = {expanded?: string}

// keep track in the module
let moduleExpandedSet = new Set<string>()

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

export default (ownProps: OwnProps) => {
  const initialExpandedSet = ownProps.expanded ? new Set(ownProps.expanded) : undefined
  const error = Constants.useGitState(state => state.error)
  const loading = Container.useSelector(state => anyWaiting(state, Constants.loadingWaitingKey))
  const git = Constants.useGitState(state => state.idToInfo)
  const loadGit = Constants.useGitState(state => state.dispatchLoad)
  const clearBadges = Constants.useGitState(state => state.dispatchClearBadges)

  const dispatchSetError = Constants.useGitState(state => state.dispatchSetError)
  const {personals, teams} = getRepos(git)

  const dispatch = Container.useDispatch()

  const onBack = React.useCallback(() => {
    dispatch(RouteTreeGen.createNavigateUp())
  }, [dispatch])
  const onShowDelete = React.useCallback(
    (id: string) => {
      dispatchSetError(undefined)
      dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {id}, selected: 'gitDeleteRepo'}]}))
    },
    [dispatch, dispatchSetError]
  )

  useFocusEffect(
    React.useCallback(() => {
      loadGit()
    }, [loadGit])
  )
  Container.useOnUnMountOnce(() => {
    clearBadges()
  })

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
      const onNewPersonalRepo = () => {
        dispatchSetError(undefined)
        dispatch(
          RouteTreeGen.createNavigateAppend({path: [{props: {isTeam: false}, selected: 'gitNewRepo'}]})
        )
      }
      const onNewTeamRepo = () => {
        dispatchSetError(undefined)
        dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {isTeam: true}, selected: 'gitNewRepo'}]}))
      }
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
    [dispatch]
  )
  const {toggleShowingPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  return (
    <Kb.Reloadable
      waitingKeys={Constants.loadingWaitingKey}
      onBack={Container.isMobile ? onBack : undefined}
      onReload={loadGit}
      reloadOnMount={true}
    >
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
    </Kb.Reloadable>
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
