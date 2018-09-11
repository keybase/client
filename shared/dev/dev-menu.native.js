// @flow
import React, {Component} from 'react'
import {Box, Text} from '../common-adapters'
import {connect} from '../util/container'
import {globalStyles, globalColors} from '../styles'
import {navigateAppend} from '../actions/route-tree'

class DevMenu extends Component<any> {
  render() {
    const menuItems = [
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
    onPushDebug: () => dispatch(navigateAppend(['push'])),
    onTestPopup: () => dispatch(navigateAppend(['testPopup'])),
  }),
  (s, d, o) => ({...o, ...s, ...d})
)(DevMenu)
