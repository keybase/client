// @flow
import * as KBFSGen from '../../actions/kbfs-gen'
import React, {Component} from 'react'
import {BackButton, Box, Text} from '../../common-adapters'
import {globalStyles, globalColors, platformStyles} from '../../styles'
import {shell} from 'electron'
import {connect, type TypedState} from '../../util/container'

type Props = {
  appFocusedCount: number,
  clearFuseInstall: () => void,
  getFuseStatus: () => void,
}

type State = {
  appFocusedCount: number,
}

class InstallSecurityPrefs extends Component<Props, State> {
  state = {
    appFocusedCount: -1,
  }

  componentWillReceiveProps(nextProps: Props) {
    // When app is focused, re-check Fuse status
    if (nextProps.appFocusedCount !== this.state.appFocusedCount) {
      this.setState({
        appFocusedCount: nextProps.appFocusedCount,
      })
      this.props.getFuseStatus()
    }
  }

  _openSecurityPrefs = () => {
    shell.openExternal('x-apple.systempreferences:com.apple.preference.security?General')
  }

  render() {
    return (
      <Box style={stylesContainer}>
        <BackButton key="back" onClick={this.props.clearFuseInstall} style={stylesClose} />
        <Text type="HeaderBig" style={{paddingBottom: 13, paddingTop: 10}}>
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
            <Box style={globalStyles.flexBoxRow}>
              <Text type="BodySemibold" style={stylesNumberList}>
                1
              </Text>
              <Text type="BodySemibold" style={styleListText}>
                Click the lock icon then enter your password
              </Text>
            </Box>
            <Box style={globalStyles.flexBoxRow}>
              <Text type="BodySemibold" style={stylesNumberList}>
                2
              </Text>
              <Text type="BodySemibold" style={styleListText}>
                Click "Allow"
              </Text>
            </Box>
            <Text
              type="BodySemiboldLink"
              style={{fontSize: 14, paddingTop: 20}}
              onClick={this._openSecurityPrefs}
            >
              Open Security & Privacy Settings
            </Text>
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
  position: 'relative',
}

const stylesNumberList = platformStyles({
  isElectron: {
    backgroundColor: globalColors.blue,
    borderRadius: '50%',
    color: globalColors.white,
    height: 20,
    marginRight: 13,
    minWidth: 20,
    paddingTop: 1,
    textAlign: 'center',
    width: 20,
  },
})

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

const stylesClose = {
  left: 10,
  position: 'absolute',
  top: 10,
}

const mapStateToProps = (state: TypedState) => {
  return {
    appFocusedCount: state.config.appFocusedCount,
  }
}

const mapDispatchToProps = (dispatch: any) => ({
  clearFuseInstall: () => dispatch(KBFSGen.createClearFuseInstall()),
  getFuseStatus: () => dispatch(KBFSGen.createFuseStatus()),
})

export default connect(mapStateToProps, mapDispatchToProps)(InstallSecurityPrefs)
