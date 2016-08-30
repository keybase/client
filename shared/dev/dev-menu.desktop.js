// @flow
import MenuList from '../settings/menu-list'
import React, {Component} from 'react'
import RemoteComponent from '../../desktop/renderer/remote-component'
import developer from './developer.desktop'
import dumbSheet from './dumb-sheet'
import engine from '../engine'
import login from '../login'
import pinentry from '../pinentry'
import styleSheet from './style-sheet'
import tracker from '../tracker'
import {BackButton, Box} from '../common-adapters'
import {connect} from 'react-redux'
import {globalStyles} from '../styles'
import {loginTab} from '../constants/tabs'
import {logout} from '../actions/login'
import {pushDebugTracker} from '../actions/tracker'
import {routeAppend, navigateUp, switchTab} from '../actions/router'

class Foo extends Component {
  render () {
    const payload = {
      features: {
        secretStorage: {allow: true, label: 'store your test passphrase'},
      },
      prompt: 'Enter a test passphrase',
      retryLabel: '',
      windowTitle: 'Keybase Test Passphrase',
    }
    return (
      <RemoteComponent
        component='pinentry'
        {...payload} />)
  }
}

class DevMenu extends Component {
  render () {
    const menuItems = [
      {name: 'Login',
        onClick: () => { this.props.switchTab(loginTab) }},
      {name: 'Register',
        onClick: () => {
          this.props.switchTab(loginTab)
          this.props.routeAppend(['register'])
        },
      },
      {name: 'reset',
        onClick: () => {
          engine.reset()
          console.log('Engine reset!')
        },
      },
      {name: 'Sign Out', onClick: () => { this.props.logout() }},
      {name: 'Passphrase entry', onClick: () => { this.props.routeAppend('pinentry') }},
      {name: 'Developer', hasChildren: true, onClick: () => { this.props.routeAppend('developer') }},
      {name: 'Tracker Listener', hasChildren: true, onClick: () => { this.props.showTrackerListener('max') }},
      {name: 'Remote Window',
        hasChildren: true,
        onClick: () => { this.props.routeAppend([{parseRoute: {componentAtTop: {component: Foo}}}]) }},
      {name: 'Dumb components', hasChildren: true, onClick: () => { this.props.routeAppend(['dumbSheet']) }},
      {name: 'Stylesheet', hasChildren: true, onClick: () => { this.props.routeAppend(['styleSheet']) }},
    ]
    return (
      <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
        <BackButton onClick={() => this.props.navigateUp()} />
        <MenuList items={menuItems} />
      </Box>
    )
  }

  static parseRoute () {
    return {
      componentAtTop: {title: 'Dev Menu'},
      subRoutes: {developer, login, pinentry, tracker, styleSheet, dumbSheet},
    }
  }
}

export default connect(
  null,
  dispatch => {
    return {
      navigateUp: () => dispatch(navigateUp()),
      routeAppend: uri => dispatch(routeAppend(uri)),
      switchTab: tabName => dispatch(switchTab(tabName)),
      logout: () => dispatch(logout()),
      showTrackerListener: username => dispatch(pushDebugTracker(username)),
    }
  }
)(DevMenu)
