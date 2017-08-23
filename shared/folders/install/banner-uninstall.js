// @flow
import React, {Component} from 'react'
import {Box, ProgressIndicator, Text} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {connect} from 'react-redux'
import {openInKBFS, uninstallKBFS} from '../../actions/kbfs'
import electron from 'electron'
import {isWindows} from '../../constants/platform'

import type {TypedState} from '../../constants/reducer'

type Props = {
  inProgress: boolean,
  openInKBFS: () => void,
  uninstallKBFSAndRestart: () => void,
}

class InstalledBanner extends Component<void, Props, void> {
  _onUninstall = () => {
    const dialog = electron.dialog || electron.remote.dialog
    dialog.showMessageBox(
      {
        buttons: ['Remove & Restart', 'Cancel'],
        detail: 'Are you sure you want to remove Keybase from the Finder and restart the app?',
        message: 'Remove Keybase from the Finder',
        type: 'question',
      },
      resp => {
        if (resp === 0) {
          this.props.uninstallKBFSAndRestart()
        }
      }
    )
  }

  _onOpen = () => {
    this.props.openInKBFS()
  }

  render() {
    if (this.props.inProgress) {
      return (
        <Box style={stylesContainer}>
          <ProgressIndicator style={{width: 32}} />
        </Box>
      )
    }

    if (isWindows) {
      return (
        <Box style={stylesContainer}>
          <Text type="BodySmall" style={{color: globalColors.black_40, textAlign: 'center'}}>
            Your Keybase folders currently appear in Explorer under&nbsp;
            <Text type="BodySmallPrimaryLink" style={globalStyles.fontTerminal} onClick={this._onOpen}>
              /keybase
            </Text>
            .
            <br />
            <Text type="BodySmall" style={{color: globalColors.black_40, textAlign: 'center'}}>
              To stop showing in Explorer, uninstall Dokan from the control panel.
            </Text>
          </Text>
        </Box>
      )
    } else {
      return (
        <Box style={stylesContainer}>
          <Text type="BodySmall" style={{color: globalColors.black_40, textAlign: 'center'}}>
            Your Keybase folders currently appear in your Finder under&nbsp;
            <Text type="BodySmallPrimaryLink" style={globalStyles.fontTerminal} onClick={this._onOpen}>
              /keybase
            </Text>
            .
            <br />
            <Text
              type="BodySmallInlineLink"
              style={{color: globalColors.black_60}}
              onClick={this._onUninstall}
            >
              Do not show them in Finder
            </Text>
          </Text>
        </Box>
      )
    }
  }
}

const stylesContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  height: 56,
  justifyContent: 'center',
  minHeight: 56,
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
}

const mapStateToProps = (state: TypedState) => ({
  inProgress: state.favorite.fuseInstalling || state.favorite.kbfsInstalling || state.favorite.kbfsOpening,
})

const mapDispatchToProps = (dispatch: any) => ({
  openInKBFS: () => dispatch(openInKBFS()),
  uninstallKBFSAndRestart: () => dispatch(uninstallKBFS()),
})

export default connect(mapStateToProps, mapDispatchToProps)(InstalledBanner)
