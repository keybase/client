import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import Row from './row/container'

export type Props = {
  expandedSet: Set<string>
  clearBadges: () => void
  loading: boolean
  onShowDelete: (id: string) => void
  onNewPersonalRepo: () => void
  onNewTeamRepo: () => void
  onToggleExpand: (id: string) => void
  personals: Array<string>
  teams: Array<string>
}

class Git extends React.Component<Props & Kb.OverlayParentProps, {}> {
  private menuItems = [
    {onClick: () => this.props.onNewPersonalRepo(), title: 'New personal repository'},
    {
      disabled: Styles.isMobile,
      onClick: Styles.isMobile ? undefined : () => this.props.onNewTeamRepo(),
      style: Styles.isMobile ? {paddingLeft: 0, paddingRight: 0} : {},
      title: `New team repository${Styles.isMobile ? ' (desktop only)' : ''}`,
    },
  ]

  rowPropsToProps = (id: string) => ({
    expanded: this.props.expandedSet.has(id),
    id,
    onShowDelete: this.props.onShowDelete,
    onToggleExpand: this.props.onToggleExpand,
  })

  renderItem = ({item}) => <Row key={item} {...this.rowPropsToProps(item)} />

  renderSectionHeader = ({section}) => (
    <Kb.SectionDivider label={section.title} showSpinner={section.loading} />
  )

  render() {
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container}>
        {Styles.isMobile && (
          <Kb.ClickableBox
            ref={this.props.setAttachmentRef}
            style={styles.header}
            onClick={this.props.toggleShowingMenu}
          >
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
          keyExtractor={item => (typeof item === 'string' ? item : item.title)}
          extraData={this.props.expandedSet}
          renderItem={this.renderItem}
          renderSectionHeader={this.renderSectionHeader}
          sections={[
            {data: this.props.personals, loading: this.props.loading, title: 'Personal'},
            {data: this.props.teams, loading: this.props.loading, title: 'Team'},
          ]}
        />
        <Kb.FloatingMenu
          attachTo={this.props.getAttachmentRef}
          closeOnSelect={true}
          items={this.menuItems}
          onHidden={this.props.toggleShowingMenu}
          visible={this.props.showingMenu}
          position="bottom center"
        />
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: {position: 'relative'},
  header: {
    ...Styles.globalStyles.flexBoxCenter,
    ...Styles.globalStyles.flexBoxRow,
    flexShrink: 0,
    height: 48,
  },
})

export default Kb.HeaderOnMobile(Kb.OverlayParentHOC(Git))
