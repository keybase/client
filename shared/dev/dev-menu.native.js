// @flow
import MenuList from '../settings/menu-list'
import React, {Component} from 'react'
import dumbSheet from './dumb-sheet'
import engine from '../engine'
import logSend from './log-send'
import {connect} from 'react-redux'
import {logout} from '../actions/login'
import {routeAppend} from '../actions/router'

class DevMenu extends Component {
  render () {
    const menuItems = [
      {name: 'Dumb components', hasChildren: true, onClick: this.props.onDumbSheet},
      {name: 'Reset', onClick: this.props.onReset},
      {name: 'Sign Out', onClick: this.props.logout},
      {name: 'Log Send', onClick: this.props.onLogSend},
    ]
    return (
      <MenuList items={menuItems} />
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
    onDumbSheet: () => dispatch(routeAppend('dumbSheet')),
    onReset: () => engine().reset(),
    onLogSend: () => dispatch(routeAppend('logSend')),
    logout: () => dispatch(logout()),
  }))(DevMenu)
