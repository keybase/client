// @flow
import * as LoginGen from '../actions/login-gen'
import React, {Component} from 'react'
import engine from '../engine'
import {Box, Text} from '../common-adapters'
import {connect} from '../util/container'
import {globalStyles, globalColors} from '../styles'
import {navigateAppend} from '../actions/route-tree'

class DevMenu extends Component<any> {
  render() {
    const menuItems = [
      {name: 'Dumb components', hasChildren: true, onClick: this.props.onDumbSheet},
      {name: 'Reset', onClick: this.props.onReset},
      {name: 'Sign Out', onClick: this.props.logout},
      {name: 'Log Send', onClick: this.props.onLogSend},
      {name: 'Push Debug', onClick: this.props.onPushDebug},
      {name: 'Test Popup', onClick: this.props.onTestPopup},
    ]
    return (
      <Box style={globalStyles.flexBoxRow}>
        <Box>
          {menuItems.map(m => (
            <Box key={m.name} style={{padding: 10, borderBottom: `1px solid ${globalColors.lightGrey}`}}>
              <Text onClick={m.onClick} type="Header">
                {m.name}
              </Text>
            </Box>
          ))}
        </Box>
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
    logout: () => dispatch(LoginGen.createLogout()),
  })
)(DevMenu)
