// @flow
import React, {Component} from 'react'
import {Box, ProgressIndicator, Text} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles'
import {connect} from 'react-redux'
import {fuseStatus, installFuse} from '../../actions/kbfs'

import type {TypedState} from '../../constants/reducer'

type Props = {
  fuseStatus: () => void,
  fuseInstalled: boolean,
  installing: boolean,
  installFuse: () => void,
  loading: boolean,
}

class InstallBanner extends Component<void, Props, void> {
  componentDidMount() {
    this.props.fuseStatus()
  }

  _onSubmit = () => {
    this.props.installFuse()
  }

  render() {
    if (this.props.fuseInstalled) {
      return null
    }

    if (this.props.loading) {
      return (
        <Box style={stylesContainer}>
          <ProgressIndicator style={{width: 48}} white={true} />
        </Box>
      )
    }

    return (
      <Box style={stylesContainer}>
        <Text type="BodySemibold" style={{textAlign: 'center'}} backgroundMode="HighRisk">
          Your Keybase folders are currently not showing up in your Finder.
          <br />
          <Text
            type="BodySemiboldLink"
            style={{color: globalColors.white, textDecoration: 'underline'}}
            onClick={this._onSubmit}
          >
            Display in Finder
          </Text>
        </Text>
      </Box>
    )
  }
}

const stylesContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  backgroundColor: globalColors.blue,
  flex: 1,
  justifyContent: 'center',
  minHeight: 52,
}

const mapStateToProps = (state: TypedState) => {
  return {
    installing: state.favorite.kbfsInstall.installing,
    loading: state.favorite.fuseStatus.loading,
  }
}

const mapDispatchToProps = (dispatch: any) => ({
  fuseStatus: () => dispatch(fuseStatus()),
  installFuse: () => dispatch(installFuse()),
})

export default connect(mapStateToProps, mapDispatchToProps)(InstallBanner)
