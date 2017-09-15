// @flow
import * as React from 'react'
import * as I from 'immutable'
import Row from './row/container'
import {Box, Text, Icon, ClickableBox, PopupMenu, ProgressIndicator, ScrollView} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles'
import {isMobile} from '../constants/platform'

type Props = {
  expandedSet: I.Set<string>,
  onShowDelete: (teamname: ?string, name: string) => void,
  onNewPersonalRepo: () => void,
  onNewTeamRepo: () => void,
  onToggleExpand: (id: string) => void,
  personals: Array<string>,
  teams: Array<string>,
}

type State = {
  showingMenu: boolean,
}

class Git extends React.Component<Props, State> {
  state = {
    showingMenu: false,
  }

  _toggleMenu = () => {
    this.setState(prevState => ({
      showingMenu: !prevState.showingMenu,
    }))
  }

  _menuItems = [
    {
      onClick: () => this.props.onNewPersonalRepo(),
      title: 'New personal repository',
    },
    {
      onClick: () => this.props.onNewTeamRepo(),
      title: 'New team repository',
    },
  ]

  _rowPropsToProps = (id: string) => ({
    expanded: this.props.expandedSet.has(id),
    id,
    key: id,
    onShowDelete: this.props.onShowDelete,
    onToggleExpand: this.props.onToggleExpand,
  })

  render() {
    return (
      <Box style={_gitStyle}>
        <ClickableBox style={_headerStyle} onClick={this._toggleMenu}>
          <Icon type="iconfont-new" style={{color: globalColors.blue, marginRight: globalMargins.tiny}} />
          <Text type="BodyBigLink">New encrypted git repository...</Text>
        </ClickableBox>
        <ScrollView>
          <Box style={_sectionHeaderStyle}>
            <Text type="BodySmallSemibold">Personal repositories</Text>
            {this.props.loading &&
              <ProgressIndicator
                style={{alignSelf: 'center', marginLeft: globalMargins.small, width: globalMargins.small}}
              />}
          </Box>
          {this.props.personals.map(p => <Row {...this._rowPropsToProps(p)} />)}
          <Box style={_sectionHeaderStyle}>
            <Text type="BodySmallSemibold">Team repositories</Text>
            {this.props.loading &&
              <ProgressIndicator
                style={{alignSelf: 'center', marginLeft: globalMargins.small, width: globalMargins.small}}
              />}
          </Box>
          {this.props.teams.map(p => <Row {...this._rowPropsToProps(p)} />)}
        </ScrollView>
        {this.state.showingMenu &&
          <PopupMenu items={this._menuItems} onHidden={this._toggleMenu} style={_popupStyle} />}
      </Box>
    )
  }
}

const _sectionHeaderStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  height: 24,
  paddingLeft: globalMargins.tiny,
  width: '100%',
}

const _popupStyle = isMobile
  ? {}
  : {
      marginLeft: 'auto',
      marginRight: 'auto',
      marginTop: 40,
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

export default Git
