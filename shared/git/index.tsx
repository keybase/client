import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import Row, {NewContext} from './row'
import sortBy from 'lodash/sortBy'
import type * as T from '@/constants/types'
import {useLocalBadging} from '@/util/use-local-badging'

type OwnProps = {expanded?: string}

const getRepos = (git: T.Immutable<Map<string, T.Git.GitInfo>>) =>
  sortBy([...git.values()], ['teamname', 'name']).reduce<{personals: Array<string>; teams: Array<string>}>(
    (pt, info) => {
      const target = info.teamname ? pt.teams : pt.personals
      target.push(info.id)
      return pt
    },
    {personals: [], teams: []}
  )

const Container = (ownProps: OwnProps) => {
  const loading = C.Waiting.useAnyWaiting(C.Git.loadingWaitingKey)
  const {clearBadges, load, setError, error, idToInfo, isNew} = C.useGitState(
    C.useShallow(s => {
      const {dispatch, error, idToInfo, isNew} = s
      const {clearBadges, load, setError} = dispatch
      return {clearBadges, error, idToInfo, isNew, load, setError}
    })
  )
  const {badged} = useLocalBadging(isNew, clearBadges)
  const {personals, teams} = React.useMemo(() => getRepos(idToInfo), [idToInfo])
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onShowDelete = React.useCallback(
    (id: string) => {
      setError(undefined)
      navigateAppend({props: {id}, selected: 'gitDeleteRepo'})
    },
    [navigateAppend, setError]
  )

  C.Router2.useSafeFocusEffect(
    React.useCallback(() => {
      load()
    }, [load])
  )

  const [expandedSet, setExpandedSet] = React.useState(
    ownProps.expanded ? new Set([ownProps.expanded]) : new Set()
  )

  const toggleExpand = (id: string) => {
    expandedSet.has(id) ? expandedSet.delete(id) : expandedSet.add(id)
    setExpandedSet(new Set(expandedSet))
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
      const {attachTo, hidePopup} = p
      const menuItems = [
        {icon: 'iconfont-person', onClick: onNewPersonalRepo, title: 'New personal repository'} as const,
        {icon: 'iconfont-people', onClick: onNewTeamRepo, title: 'New team repository'} as const,
      ]

      return (
        <Kb.FloatingMenu
          attachTo={attachTo}
          closeOnSelect={true}
          items={menuItems}
          onHidden={hidePopup}
          visible={true}
          position="bottom center"
        />
      )
    },
    [navigateAppend, setError]
  )
  const {showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  return (
    <Kb.Reloadable
      waitingKeys={C.Git.loadingWaitingKey}
      onBack={undefined}
      onReload={load}
      reloadOnMount={true}
    >
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container}>
        {!!error && <Kb.Banner color="red">{error.message}</Kb.Banner>}
        {Kb.Styles.isMobile && (
          <Kb.ClickableBox ref={popupAnchor} style={styles.header} onClick={showPopup}>
            <Kb.Icon
              type="iconfont-new"
              style={{marginRight: Kb.Styles.globalMargins.tiny}}
              color={Kb.Styles.globalColors.blue}
              fontSize={20}
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

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {position: 'relative'},
      header: {
        ...Kb.Styles.globalStyles.flexBoxCenter,
        ...Kb.Styles.globalStyles.flexBoxRow,
        flexShrink: 0,
        height: 48,
      },
    }) as const
)

export default Container
