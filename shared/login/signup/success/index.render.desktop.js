/* @flow */

import React, {Component} from 'react'
import {globalStyles, globalColors} from '../../../styles/style-guide'
import {Box, Text, Button, Checkbox, Icon} from '../../../common-adapters'
import {specialStyles as textStyles} from '../../../common-adapters/text'
import Container from '../../forms/container'

import type {Props} from './index.render'

type State = {
  inWallet: boolean
}

class Render extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)
    this.state = {inWallet: false}
  }

  render () {
    return (
      <Container onBack={this.props.onBack} style={stylesContainer}>
        <Text type='Header' style={stylesHeader}>{this.props.title || 'Congratulations, you’ve just joined Keybase!'}</Text>
        <Text type='Body' style={stylesBody}>Here is your unique paper key, it will allow you to perform important Keybase tasks in the future. This is the only time you’ll see this so be sure to write it down.</Text>
        <Box style={stylesPaperKeyContainer}>
          <Text type='Body' style={stylesPaperkey}>{this.props.paperkey.stringValue()}</Text>
          <Icon type='paper-key-corner' style={stylesPaperCorner} />
        </Box>
        {this.props.onFinish && <Checkbox style={stylesCheck} label='Yes, I wrote this down.' checked={this.state.inWallet} onCheck={inWallet => this.setState({inWallet})} />}
        {this.props.onFinish && <Button style={stylesButton} type='Primary' label='Done' onClick={this.props.onFinish} disabled={!this.state.inWallet} />}
      </Container>
    )
  }
}

const stylesContainer = {
  alignItems: 'center',
}
const stylesHeader = {
  marginTop: 60,
  marginBottom: 5,
}
const stylesBody = {
  paddingLeft: 15,
  paddingRight: 15,
  marginBottom: 35,
  textAlign: 'center',
}
const stylesPaperKeyContainer = {
  position: 'relative',
  width: 400,
  marginBottom: 35,
  paddingTop: 12,
  paddingLeft: 30,
  paddingRight: 45,
  paddingBottom: 15,
  borderRadius: 1,
  backgroundColor: globalColors.white,
  border: `solid 4px ${globalColors.darkBlue}`,
}
const stylesPaperCorner = {
  position: 'absolute',
  top: -4,
  right: -4,
}
const stylesCheck = {
  marginBottom: 60,
}
const stylesButton = {
  alignSelf: 'flex-end',
}
const stylesPaperkey = {
  ...textStyles.paperKey,
  ...globalStyles.selectable,
  marginBottom: 15,
  display: 'inline-block',
}

export default Render
