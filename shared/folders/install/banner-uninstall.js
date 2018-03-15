// @flow
import * as KBFSGen from '../../actions/kbfs-gen'
import React, {Component} from 'react'
import electron from 'electron'
import {Box, ProgressIndicator, Text} from '../../common-adapters'
import {connect, type TypedState} from '../../util/container'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {isWindows} from '../../constants/platform'

type Props = {
  inProgress: boolean,
  openInKBFS: () => void,
  uninstallKBFSAndRestart: () => void,
  kbfsMount: string,
}

class InstalledBanner extends Component<Props, void> {
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
      // todo: get mount drive letter on Windows?
      return (
        <Box style={stylesContainer}>
          <Text type="BodySmall" style={{color: globalColors.black_40, textAlign: 'center'}}>
            Your Keybase folders currently appear in Explorer.
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
            <Text type="BodySmallPrimaryLink" style={{...globalStyles.fontTerminal}} onClick={this._onOpen}>
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
  openInKBFS: () => dispatch(KBFSGen.createOpen({})),
  uninstallKBFSAndRestart: () => dispatch(KBFSGen.createUninstallKBFS()),
})

export default connect(mapStateToProps, mapDispatchToProps)(InstalledBanner)
