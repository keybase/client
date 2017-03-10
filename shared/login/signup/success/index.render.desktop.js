// @flow
import Container from '../../forms/container'
import React, {Component} from 'react'
import type {Props} from './index.render'
import {Box, Text, Button, Checkbox, Icon, ProgressIndicator} from '../../../common-adapters'
import {globalStyles, globalColors} from '../../../styles'
import {getStyle} from '../../../common-adapters/text'

type State = {
  inWallet: boolean,
}

class SuccessRender extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)
    this.state = {inWallet: false}
  }

  render () {
    const contents = this.props.paperkey
      ? (
        <Box style={stylesPaperKeyContainer}>
          <Text type='Header' style={stylesPaperkey}>{this.props.paperkey.stringValue()}</Text>
        </Box>
      )
      : (
        <Box style={{...stylesPaperKeyContainer, ...globalStyles.flexBoxCenter}}>
          <ProgressIndicator type='Small' style={{width: 40}} />
          <Icon type='icon-paper-key-corner' style={stylesPaperCorner} />
        </Box>
      )

    return (
      <Container onBack={this.props.onBack} style={stylesContainer}>
        <Text type='Header' style={stylesHeader}>{this.props.title || "Congratulations, you've just joined Keybase!"}</Text>
        <Text type='Body' style={stylesBody}>Here is your unique paper key, it will allow you to perform important Keybase tasks in the future. This is the only time you'll see this so be sure to write it down.</Text>
        {contents}
        {this.props.onFinish && <Checkbox style={stylesCheck} label='Yes, I wrote this down.' checked={this.state.inWallet} onCheck={inWallet => this.setState({inWallet})} />}
        {this.props.onFinish && <Button waiting={this.props.waiting} type='Primary' label='Done' onClick={this.props.onFinish} disabled={!this.state.inWallet} />}
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
  maxWidth: 560,
  textAlign: 'center',
}
const stylesPaperKeyContainer = {
  position: 'relative',
  width: 400,
  minHeight: 100,
  marginBottom: 35,
  paddingTop: 8,
  paddingLeft: 24,
  paddingRight: 24 * 2,
  paddingBottom: 8,
  borderRadius: 3,
  backgroundColor: globalColors.white,
  border: `solid 3px ${globalColors.darkBlue}`,
}
const stylesPaperCorner = {
  position: 'absolute',
  top: -3,
  right: -3,
}
const stylesCheck = {
  marginBottom: 60,
}
const stylesPaperkey = {
  ...getStyle('Header', 'Normal'),
  ...globalStyles.selectable,
  ...globalStyles.fontTerminal,
  color: globalColors.darkBlue,
  display: 'inline-block',
  textAlign: 'center',
}

export default SuccessRender
