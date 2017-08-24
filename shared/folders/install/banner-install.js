// @flow
import React, {Component} from 'react'
import {Box, Text} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {connect} from 'react-redux'
import {fuseStatus, installFuse} from '../../actions/kbfs'
import {fileUIName} from '../../constants/platform'

import type {TypedState} from '../../constants/reducer'

type Props = {
  getFuseStatus: () => void,
  fuseInstalled: boolean,
  installing: boolean,
  installFuse: () => void,
}

class InstallBanner extends Component<Props, void> {
  componentDidMount() {
    this.props.getFuseStatus()
  }

  _onSubmit = () => {
    this.props.installFuse()
  }

  render() {
    return (
      <Box style={stylesContainer}>
        <Text type="BodySemibold" style={{textAlign: 'center'}} backgroundMode="HighRisk">
          Your Keybase folders are currently not showing up in your {fileUIName}.
          <br />
          <Text
            type="BodySemiboldLink"
            style={{color: !this.props.installing ? globalColors.white : globalColors.white_75}}
            onClick={!this.props.installing ? this._onSubmit : null}
            underline={true}
          >
            Display in {fileUIName}
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
  height: 56,
  justifyContent: 'center',
  minHeight: 56,
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
}

const mapStateToProps = (state: TypedState) => {
  return {
    installing: state.favorite.fuseInstalling,
  }
}

const mapDispatchToProps = (dispatch: any) => ({
  getFuseStatus: () => dispatch(fuseStatus()),
  installFuse: () => dispatch(installFuse()),
})

export default connect(mapStateToProps, mapDispatchToProps)(InstallBanner)
