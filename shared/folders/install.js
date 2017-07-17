// @flow
import React, {Component} from 'react'
import {Box, Button, ProgressIndicator, Text} from '../common-adapters'
import {globalStyles, globalColors} from '../styles'
import {connect} from 'react-redux'
import {fuseStatus, installKBFS} from '../actions/kbfs'

import type {TypedState} from '../constants/reducer'

type Props = {
  fuseStatus: () => void,
  installing: boolean,
  installKBFS: () => void,
  loading: boolean,
}

class Install extends Component<void, Props, void> {
  componentDidMount() {
    this.props.fuseStatus()
  }

  _onSubmit = () => {
    this.props.installKBFS()
  }

  render() {
    if (this.props.loading) {
      return (
        <Box style={stylesContainer}>
          <ProgressIndicator style={{width: 48}} />
        </Box>
      )
    }

    return (
      <Box style={stylesContainer}>
        <Text type="Body" style={{paddingBottom: 10}}>You need to install KBFS.</Text>
        <Button type="Primary" label="Install" onClick={this._onSubmit} disabled={this.props.installing} />
      </Box>
    )
  }
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  backgroundColor: globalColors.white,
  flex: 1,
  justifyContent: 'center',
}

const mapStateToProps = (state: TypedState) => {
  return {
    installing: state.favorite.kbfsInstall.installing,
    loading: state.favorite.fuseStatus.loading,
  }
}

const mapDispatchToProps = (dispatch: any) => ({
  fuseStatus: () => dispatch(fuseStatus()),
  installKBFS: () => dispatch(installKBFS()),
})

export default connect(mapStateToProps, mapDispatchToProps)(Install)
