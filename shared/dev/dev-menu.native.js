// @flow
import MenuList from '../settings/menu-list'
import React, {Component} from 'react'
import dumbSheet from './dumb-sheet'
import engine from '../engine'
import {connect} from 'react-redux'
import {logout} from '../actions/login'
import {routeAppend} from '../actions/router'

class DevMenu extends Component {
  render () {
    const menuItems = [
      {name: 'reset', onClick: () => { engine().reset() }},
      {name: 'Sign Out', onClick: () => { this.props.logout() }},
      {name: 'Dumb components', hasChildren: true, onClick: this.props.onDumbSheet},
    ]
    return (
      <MenuList items={menuItems} />
    )
  }

  static parseRoute () {
    return {
      componentAtTop: {title: 'Dev Menu'},
      subRoutes: {dumbSheet},
    }
  }
}

export default connect(
  state => ({}),
  (dispatch: any) => ({
    onDumbSheet: () => dispatch(routeAppend('dumbSheet')),
    logout: () => dispatch(logout()),
  }))(DevMenu)
