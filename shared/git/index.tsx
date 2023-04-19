import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import Row from './row/container'
import {union} from '../util/set'

export type Props = {
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

  const menuItems = [
    {icon: 'iconfont-person', onClick: onNewPersonalRepo, title: 'New personal repository'} as const,
    {icon: 'iconfont-people', onClick: onNewTeamRepo, title: 'New team repository'} as const,
  ]

  const {toggleShowingPopup, showingPopup, popup, popupAnchor} = Kb.usePopup(attachTo => (
    <Kb.FloatingMenu
      attachTo={attachTo}
      closeOnSelect={true}
      items={menuItems}
      onHidden={toggleShowingPopup}
      visible={showingPopup}
      position="bottom center"
    />
  ))

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

export default Git
