// @flow
import React, {Component} from 'react'
import {Box, Text} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles'
import {shell} from 'electron'

class InstallSecurityPrefs extends Component {
  _openSecurityPrefs = () => {
    shell.openExternal('x-apple.systempreferences:com.apple.preference.security?General')
  }

  render() {
    return (
      <Box style={stylesContainer}>
        <Text type="HeaderBig" style={{paddingBottom: 13, paddingTop: 32}}>
          Ghhh. Try this.
        </Text>
        <Text type="Body" style={{paddingBottom: 24}}>
          Open your macOS Security & Privacy Settings and follow these steps.
        </Text>
        <Box style={{...globalStyles.flexBoxRow, marginRight: 20}}>
          <Box style={{position: 'relative'}}>
            <img width={500} height={437} src={require('../../images/install/security-preferences.png')} />
            <Box
              style={{...styleHighlight, height: 30, left: 42, position: 'absolute', top: 350, width: 162}}
            />
            <Text type="BodySemibold" style={{...stylesNumberList, left: 72, position: 'absolute', top: 374}}>
              1
            </Text>
            <Box
              style={{...styleHighlight, height: 30, left: 352, position: 'absolute', top: 282, width: 94}}
            />
            <Text
              type="BodySemibold"
              style={{...stylesNumberList, left: 432, position: 'absolute', top: 302}}
            >
              2
            </Text>
          </Box>
          <Box style={{...globalStyles.flexBoxColumn, marginTop: 30}}>
            <Text
              type="BodySemiboldLink"
              style={{fontSize: 14, paddingBottom: 20}}
              onClick={this._openSecurityPrefs}
            >
              Open Security & Privacy Settings
            </Text>
            <Box style={{...globalStyles.flexBoxRow}}>
              <Text type="BodySemibold" style={stylesNumberList}>
                1
              </Text>
              <Text type="BodySemibold" style={styleListText}>
                Click the lock icon then enter your password
              </Text>
            </Box>
            <Box style={{...globalStyles.flexBoxRow}}>
              <Text type="BodySemibold" style={stylesNumberList}>
                2
              </Text>
              <Text type="BodySemibold" style={styleListText}>Click "Allow"</Text>
            </Box>
          </Box>
        </Box>
      </Box>
    )
  }
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  flex: 1,
  height: '100%',
  justifyContent: 'center',
  overflowY: 'auto',
}

const stylesNumberList = {
  backgroundColor: globalColors.blue,
  borderRadius: '50%',
  color: globalColors.white,
  height: 20,
  marginRight: 13,
  minWidth: 20,
  paddingTop: 1,
  textAlign: 'center',
  width: 20,
}

const styleListText = {
  paddingBottom: 16,
  paddingTop: 1,
}

const styleHighlight = {
  backgroundColor: globalColors.black_05,
  borderColor: globalColors.blue,
  borderRadius: 100,
  borderStyle: 'solid',
  borderWidth: 2,
}

export default InstallSecurityPrefs
