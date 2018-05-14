// @flow
import * as React from 'react'
import * as I from 'immutable'
import Row from './row/container'
import {
  Box,
  Box2,
  Text,
  Icon,
  ClickableBox,
  ProgressIndicator,
  ScrollView,
  HeaderHoc,
  FloatingMenu,
} from '../common-adapters'
import {FloatingMenuParentHOC, type FloatingMenuParentProps} from '../common-adapters/floating-menu'
import {desktopStyles, globalStyles, globalColors, globalMargins, isMobile, styleSheetCreate} from '../styles'
import {branch} from 'recompose'

type Props = {
  expandedSet: I.Set<string>,
  loading: boolean,
  onShowDelete: (id: string) => void,
  onNewPersonalRepo: () => void,
  onNewTeamRepo: () => void,
  onToggleExpand: (id: string) => void,
  personals: Array<string>,
  teams: Array<string>,
}

class _Git extends React.Component<Props & FloatingMenuParentProps, {}> {
  _menuItems = [
    {
      onClick: () => this.props.onNewPersonalRepo(),
      title: 'New personal repository',
    },
    {
      disabled: isMobile,
      onClick: isMobile ? undefined : () => this.props.onNewTeamRepo(),
      style: isMobile ? {paddingLeft: 0, paddingRight: 0} : {},
      title: `New team repository${isMobile ? ' (desktop only)' : ''}`,
    },
  ]

  _rowPropsToProps = (id: string) => ({
    expanded: this.props.expandedSet.has(id),
    id,
    onShowDelete: this.props.onShowDelete,
    onToggleExpand: this.props.onToggleExpand,
  })

  render() {
    return (
      <Box style={_gitStyle}>
        <Box2 direction="horizontal" fullWidth={true} style={styles.header}>
          <ClickableBox
            ref={this.props.setAttachmentRef}
            style={_headerStyle}
            onClick={this.props.toggleShowingMenu}
          >
            <Icon
              type="iconfont-new"
              style={{marginRight: globalMargins.tiny}}
              color={globalColors.blue}
              fontSize={isMobile ? 20 : 16}
            />
            <Text type="BodyBigLink">New encrypted git repository...</Text>
          </ClickableBox>
        </Box2>
        <ScrollView>
          <Box style={_sectionHeaderStyle}>
            <Text type="BodySmallSemibold">Personal</Text>
            {this.props.loading && (
              <ProgressIndicator
                style={{alignSelf: 'center', marginLeft: globalMargins.small, width: globalMargins.small}}
              />
            )}
          </Box>
          {this.props.personals.map(p => <Row key={p} {...this._rowPropsToProps(p)} />)}
          <Box style={_sectionHeaderStyle}>
            <Text type="BodySmallSemibold">Team</Text>
            {this.props.loading && (
              <ProgressIndicator
                style={{alignSelf: 'center', marginLeft: globalMargins.small, width: globalMargins.small}}
              />
            )}
          </Box>
          {this.props.teams.map(p => <Row key={p} {...this._rowPropsToProps(p)} />)}
        </ScrollView>
        <FloatingMenu
          attachTo={this.props.attachmentRef}
          closeOnSelect={true}
          items={this._menuItems}
          onHidden={this.props.toggleShowingMenu}
          visible={this.props.showingMenu}
          position="bottom center"
        />
      </Box>
    )
  }
}
const Git = FloatingMenuParentHOC(_Git)

const _sectionHeaderStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  height: isMobile ? 32 : 24,
  paddingLeft: globalMargins.tiny,
  marginTop: globalMargins.small,
  width: '100%',
}

const _headerStyle = {
  ...globalStyles.flexBoxCenter,
  ...globalStyles.flexBoxRow,
  flexShrink: 0,
  height: 48,
}

const _gitStyle = {
  ...globalStyles.flexBoxColumn,
  height: '100%',
  position: 'relative',
  width: '100%',
}

const styles = styleSheetCreate({
  header: {
    ...desktopStyles.windowDragging,
    ...globalStyles.flexBoxCenter,
  },
})

export default branch(() => isMobile, HeaderHoc)(Git)
