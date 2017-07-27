// @flow
import React, {Component} from 'react'
import {Box, ProgressIndicator, Text} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {connect} from 'react-redux'
import {uninstallKBFS} from '../../actions/kbfs'
import electron from 'electron'

import type {TypedState} from '../../constants/reducer'

type Props = {
  inProgress: boolean,
  uninstallKBFSAndRestart: () => void,
}

class InstalledBanner extends Component<void, Props, void> {
  _onSubmit = () => {
    const dialog = electron.dialog || electron.remote.dialog
    dialog.showMessageBox(
      {
        buttons: ['Uninstall & Restart', 'Cancel'],
        detail: 'Are you sure you want to uninstall Keybase from the Finder and restart the app?',
        message: 'Uninstall in Finder',
        type: 'question',
      },
      resp => {
        if (resp === 0) {
          this.props.uninstallKBFSAndRestart()
        }
      }
    )
  }

  render() {
    if (this.props.inProgress) {
      return (
        <Box style={stylesContainer}>
          <ProgressIndicator style={{width: 32}} />
        </Box>
      )
    }

    return (
      <Box style={stylesContainer}>
        <Text type="BodySmall" style={{color: globalColors.black_40, textAlign: 'center'}}>
          Your Keybase folders currently appear in your Finder under&nbsp;
          <Text type="Terminal" style={{color: globalColors.blue, fontSize: 11}}>/keybase</Text>.
          <br />
          <Text type="BodySmallInlineLink" style={{color: globalColors.black_60}} onClick={this._onSubmit}>
            Do not show them in Finder
          </Text>
        </Text>
      </Box>
    )
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
  inProgress: state.favorite.fuseInstalling || state.favorite.kbfsOpening,
})

const mapDispatchToProps = (dispatch: any) => ({
  uninstallKBFSAndRestart: () => dispatch(uninstallKBFS()),
})

export default connect(mapStateToProps, mapDispatchToProps)(InstalledBanner)
