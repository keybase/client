// @flow
import React, {Component} from 'react'
import Container from '../../forms/container'
import type {Props} from './index.render'
import {Box, Checkbox, Button, Text, Icon} from '../../../common-adapters'
import {globalColors, globalStyles, globalMargins} from '../../../styles'
import {getStyle} from '../../../common-adapters/text'

type State = {
  checked: boolean,
}

class SuccessRender extends Component<void, Props, State> {
  state = {
    checked: false,
  }

  render() {
    return (
      <Container style={{alignItems: 'center', paddingBottom: globalMargins.small}}>
        <Text type="Header" style={textCenter}>
          {this.props.title || "Congratulations, you've just joined Keybase!"}
        </Text>
        <Text type="Body" style={{...textCenter, marginTop: globalMargins.medium}}>
          Here is your unique paper key, it will allow you to perform important Keybase tasks in the future. This is the only time you'll see this so be sure to write it down.
        </Text>

        <Box style={paperKeyContainerStyle}>
          <Text type="Header" style={paperkeyStyle}>{this.props.paperkey.stringValue()}</Text>
          <Box style={paperCornerStyle}>
            <Icon type="icon-paper-key-corner" />
          </Box>
        </Box>

        <Checkbox
          label="Yes, I wrote this down."
          checked={this.state.checked}
          onCheck={checked => this.setState({checked})}
        />

        <Button
          disabled={!this.state.checked}
          onClick={this.props.onFinish}
          label="Done"
          type="Primary"
          style={{marginTop: globalMargins.small}}
        />
      </Container>
    )
  }
}

const textCenter = {
  textAlign: 'center',
}

const paperKeyContainerStyle = {
  alignSelf: 'center',
  backgroundColor: globalColors.white,
  borderColor: globalColors.darkBlue,
  borderRadius: 4,
  borderStyle: 'solid',
  borderWidth: 4,
  marginBottom: globalMargins.medium,
  marginTop: globalMargins.small,
  paddingBottom: globalMargins.small,
  paddingLeft: globalMargins.small,
  paddingRight: globalMargins.large,
  paddingTop: globalMargins.small,
}

const paperkeyStyle = {
  ...getStyle('Header', 'Normal'),
  ...globalStyles.fontTerminal,
  color: globalColors.darkBlue,
  textAlign: 'center',
}

const paperCornerStyle = {
  position: 'absolute',
  right: -4,
  top: -4,
}

export default SuccessRender
