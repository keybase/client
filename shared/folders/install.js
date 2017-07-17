// @flow
import React, {Component} from 'react'
import {Box, Button, Text} from '../common-adapters'
import {globalStyles, globalColors} from '../styles'
import {connect} from 'react-redux'
import {installKBFS} from '../actions/kbfs'

type Props = {
  installKBFS: () => void,
}

class Install extends Component<void, Props, void> {
  _onSubmit = () => {
    this.props.installKBFS()
  }

  render() {
    return (
      <Box style={stylesContainer}>
        <Text type="Body">You need to install KBFS</Text>
        <Button type="Primary" label="Install" onClick={this._onSubmit} />
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

const mapStateToProps = () => {
  return {}
}

const mapDispatchToProps = (dispatch: any) => ({
  installKBFS: () => dispatch(installKBFS()),
})

export default connect(mapStateToProps, mapDispatchToProps)(Install)
