import * as React from 'react'
import * as I from 'immutable'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import Row from './row/container'

export type Props = {
  expandedSet: I.Set<string>
  clearBadges: () => void
  loading: boolean
  onShowDelete: (id: string) => void
  onNewPersonalRepo: () => void
  onNewTeamRepo: () => void
  onToggleExpand: (id: string) => void
  personals: Array<string>
  teams: Array<string>
}

class _Git extends React.Component<Props & Kb.OverlayParentProps, {}> {
  _menuItems = [
    {
      onClick: () => this.props.onNewPersonalRepo(),
      title: 'New personal repository',
    },
    {
      disabled: Styles.isMobile,
      onClick: Styles.isMobile ? undefined : () => this.props.onNewTeamRepo(),
      style: Styles.isMobile ? {paddingLeft: 0, paddingRight: 0} : {},
      title: `New team repository${Styles.isMobile ? ' (desktop only)' : ''}`,
    },
  ]

  _rowPropsToProps = (id: string) => ({
    expanded: this.props.expandedSet.has(id),
    id,
    onShowDelete: this.props.onShowDelete,
    onToggleExpand: this.props.onToggleExpand,
  })

  _renderItem = ({item, section}) => <Row key={item} {...this._rowPropsToProps(item)} />

  _renderSectionHeader = ({section}) => (
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
          keyExtractor={item => item}
          renderItem={this._renderItem}
          renderSectionHeader={this._renderSectionHeader}
          sections={[
            {data: this.props.personals, loading: this.props.loading, title: 'Personal'},
            {data: this.props.teams, loading: this.props.loading, title: 'Team'},
          ]}
        />
        <Kb.FloatingMenu
          attachTo={this.props.getAttachmentRef}
          closeOnSelect={true}
          items={this._menuItems}
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

export default Kb.HeaderOnMobile(Kb.OverlayParentHOC(_Git))
