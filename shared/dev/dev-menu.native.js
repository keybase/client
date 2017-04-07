// @flow
import MenuList from '../settings/menu-list'
import React, {Component} from 'react'
import engine from '../engine'
import {connect} from 'react-redux'
import {logout} from '../actions/login/creators'
import {navigateAppend, switchTo} from '../actions/route-tree'
import {Box} from '../common-adapters'
import {globalStyles} from '../styles'
import {devicesTab} from '../constants/tabs'

class DevMenu extends Component {
  render () {
    const menuItems = [
      {name: 'Dumb components', hasChildren: true, onClick: this.props.onDumbSheet},
      {name: 'Reset', onClick: this.props.onReset},
      {name: 'Sign Out', onClick: this.props.logout},
      {name: 'Log Send', onClick: this.props.onLogSend},
      {name: 'Push Debug', onClick: this.props.onPushDebug},
      {name: 'Test Popup', onClick: this.props.onTestPopup},
      {name: 'Devices', onClick: this.props.onDevices},
    ]
    return (
      <Box style={{...globalStyles.flexBoxRow}}>
        <MenuList items={menuItems} />
      </Box>
    )
  }
}

export default connect(
  state => ({}),
  (dispatch: any) => ({
    onDumbSheet: () => dispatch(navigateAppend(['dumbSheet'])),
    onReset: () => engine().reset(),
    onLogSend: () => dispatch(navigateAppend(['logSend'])),
    onPushDebug: () => dispatch(navigateAppend(['push'])),
    onTestPopup: () => dispatch(navigateAppend(['testPopup'])),
    logout: () => dispatch(logout()),
    onDevices: () => dispatch(switchTo([devicesTab])),
  }))(DevMenu)
