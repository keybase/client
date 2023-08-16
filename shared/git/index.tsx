import * as C from '../constants'
import * as Container from '../util/container'
import * as Kb from '../common-adapters'
import * as React from 'react'
import * as Styles from '../styles'
import Row, {NewContext} from './row'
import sortBy from 'lodash/sortBy'
import type * as T from '../constants/types'
import {memoize} from '../util/memoize'
import {union} from '../util/set'
import {useFocusEffect} from '@react-navigation/core'
import {useLocalBadging} from '../util/use-local-badging'
import shallowEqual from 'shallowequal'

type OwnProps = {expanded?: string}

// keep track in the module
let moduleExpandedSet = new Set<string>()

const getRepos = memoize((git: Map<string, T.Git.GitInfo>) =>
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
  const initialExpandedSet = ownProps.expanded ? new Set([ownProps.expanded]) : undefined
  const loading = Container.useAnyWaiting(C.gitWaitingKey)
  const {clearBadges, load, setError, error, idToInfo, isNew} = C.useGitState(s => {
    const {dispatch, error, idToInfo, isNew} = s
    const {clearBadges, load, setError} = dispatch
    return {clearBadges, error, idToInfo, isNew, load, setError}
  }, shallowEqual)
  const {badged} = useLocalBadging(isNew, clearBadges)
  const {personals, teams} = getRepos(idToInfo)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = navigateUp
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onShowDelete = React.useCallback(
    (id: string) => {
      setError(undefined)
      navigateAppend({props: {id}, selected: 'gitDeleteRepo'})
    },
    [navigateAppend, setError]
  )

  useFocusEffect(
    React.useCallback(() => {
      load()
    }, [load])
  )

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
        setError(undefined)
        navigateAppend({props: {isTeam: false}, selected: 'gitNewRepo'})
      }
      const onNewTeamRepo = () => {
        setError(undefined)
        navigateAppend({props: {isTeam: true}, selected: 'gitNewRepo'})
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
    [navigateAppend, setError]
  )
  const {toggleShowingPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  return (
    <Kb.Reloadable
      waitingKeys={C.gitWaitingKey}
      onBack={Container.isMobile ? onBack : undefined}
      onReload={load}
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
        <NewContext.Provider value={badged}>
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
        </NewContext.Provider>
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
    }) as const
)
