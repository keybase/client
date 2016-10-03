// @flow
import MenuList from '../settings/menu-list'
import React, {Component} from 'react'
import dumbSheet from './dumb-sheet'
import engine from '../engine'
import {BackButton, Box} from '../common-adapters'
import {connect} from 'react-redux'
import {globalStyles} from '../styles'
import {logout} from '../actions/login'
import {routeAppend, navigateUp} from '../actions/router'

class DevMenu extends Component {
  render () {
    const menuItems = [
      {name: 'Dumb components', hasChildren: true, onClick: this.props.onDumbSheet},
      {name: 'Reset engine', onClick: this.props.onReset},
      {name: 'Sign Out', onClick: this.props.onSignOut},
    ]
    return (
      <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
        <BackButton onClick={() => this.props.onBack()} />
        <MenuList items={menuItems} />
      </Box>
    )
  }

  static parseRoute () {
    return {
      componentAtTop: {title: 'Dev Menu'},
      subRoutes: {dumbSheet},
    }
  }
}

// $FlowIssue
export default connect(
  state => ({}),
  dispatch => ({
    onReset: () => engine().reset(),
    onSignOut: () => dispatch(logout()),
    onBack: () => dispatch(navigateUp()),
    onDumbSheet: () => dispatch(routeAppend(['dumbSheet'])),
  }))(DevMenu)
