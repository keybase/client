// @flow
import * as React from 'react'
import Row from './row'
import {Box, Text, Icon, ClickableBox, PopupMenu} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles'
import {isMobile} from '../constants/platform'

import type {Props as RowProps} from './row'

type Props = {
  onCopy: (url: string) => void,
  onDelete: (url: string) => void,
  onNewPersonalRepo: () => void,
  onNewTeamRepo: () => void,
  personals: Array<RowProps>,
  teams: Array<RowProps>,
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
      title: 'New personal repository',
      onClick: () => this.props.onNewPersonalRepo(),
    },
    {
      title: 'New team repository',
      onClick: () => this.props.onNewTeamRepo(),
    },
  ]

  render() {
    return (
      <Box style={_gitStyle}>
        <ClickableBox style={_headerStyle} onClick={this._toggleMenu}>
          <Icon type="iconfont-new" style={{color: globalColors.blue, marginRight: globalMargins.tiny}} />
          <Text type="BodyBigLink">New encrypted git repository...</Text>
        </ClickableBox>
        <Box style={_sectionHeaderStyle}>
          <Text type="BodySmallSemibold">Personal repositories</Text>
        </Box>
        {this.props.personals.map(p => (
          <Row {...p} key={p.url} onCopy={this.props.onCopy} onDelete={this.props.onDelete} />
        ))}
        <Box style={_sectionHeaderStyle}>
          <Text type="BodySmallSemibold">Team repositories</Text>
        </Box>
        {this.props.teams.map(p => (
          <Row {...p} key={p.url} onCopy={this.props.onCopy} onDelete={this.props.onDelete} />
        ))}
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
