// @flow
import React, {Component} from 'react'
import {Box, Text} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {connect} from 'react-redux'

import type {TypedState} from '../../constants/reducer'

type Props = {}

class TeamNameBanner extends Component<Props, void> {
  _onSubmit = () => {}

  render() {
    return (
      <Box style={stylesContainer}>
        <Text type="BodySemibold" style={{textAlign: 'center'}} backgroundMode="HighRisk">
          Create a team? You’ll be able to add and remove members as you wish.
          <br />
          <Text
            type="BodySemiboldLink"
            style={{color: globalColors.white}}
            onClick={this._onSubmit}
            underline={true}
          >
            Enter a team name
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
  return {}
}

const mapDispatchToProps = (dispatch: any) => ({})

export default connect(mapStateToProps, mapDispatchToProps)(TeamNameBanner)
