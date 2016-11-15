// @flow
import MenuList from '../settings/menu-list'
import React, {Component} from 'react'
import dumbSheet from './dumb-sheet'
import engine from '../engine'
import logSend from './log-send'
import {connect} from 'react-redux'
import {logout} from '../actions/login'
import {navigateAppend} from '../actions/route-tree'
import {Box} from '../common-adapters'
import {globalStyles} from '../styles'

class DevMenu extends Component {
  render () {
    const menuItems = [
      {name: 'Dumb components', hasChildren: true, onClick: this.props.onDumbSheet},
      {name: 'Reset', onClick: this.props.onReset},
      {name: 'Sign Out', onClick: this.props.logout},
      {name: 'Log Send', onClick: this.props.onLogSend},
    ]
    return (
      <Box style={{...globalStyles.flexBoxRow}}>
        <MenuList items={menuItems} />
      </Box>
    )
  }

  static parseRoute () {
    return {
      componentAtTop: {title: 'Dev Menu'},
      subRoutes: {dumbSheet, logSend},
    }
  }
}

export default connect(
  state => ({}),
  (dispatch: any) => ({
    onDumbSheet: () => dispatch(navigateAppend(['dumbSheet'])),
    onReset: () => engine().reset(),
    onLogSend: () => dispatch(navigateAppend(['logSend'])),
    logout: () => dispatch(logout()),
  }))(DevMenu)
