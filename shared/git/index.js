// @flow
import * as React from 'react'
import * as I from 'immutable'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import Row from './row/container'

type Props = {|
  expandedSet: I.Set<string>,
  clearBadges: () => void,
  loading: boolean,
  onShowDelete: (id: string) => void,
  onNewPersonalRepo: () => void,
  onNewTeamRepo: () => void,
  onToggleExpand: (id: string) => void,
  personals: Array<string>,
  teams: Array<string>,
|}

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

  _renderItem = ({item, section}) => {
    ;<Row key={p} {...this._rowPropsToProps(item)} />
  }

  _renderSectionHeader = ({section}) => {
    return <Kb.SectionHeader title={section.title} />
  }

  render() {
    return (
      <Kb.Box style={_gitStyle}>
        <Kb.ClickableBox
          ref={this.props.setAttachmentRef}
          style={_headerStyle}
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
        <Kb.SectionList
          renderItem={this._renderItem}
          renderSectionHeader={this._renderSectionHeader}
          sections={[
            {title: 'Personal', data: this.props.personals},
            {title: 'Team', data: this.props.teams},
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
      </Kb.Box>
    )
  }
}
const Git = Kb.OverlayParentHOC(_Git)

const _sectionHeaderStyle = {
  ...Styles.globalStyles.flexBoxRow,
  alignItems: 'center',
  height: Styles.isMobile ? 32 : 24,
  marginTop: Styles.globalMargins.small,
  paddingLeft: Styles.globalMargins.tiny,
  width: '100%',
}

const _headerStyle = {
  ...Styles.globalStyles.flexBoxCenter,
  ...Styles.globalStyles.flexBoxRow,
  flexShrink: 0,
  height: 48,
}

const _gitStyle = {
  ...Styles.globalStyles.flexBoxColumn,
  height: '100%',
  position: 'relative',
  width: '100%',
}

export default Kb.HeaderOnMobile(Git)
