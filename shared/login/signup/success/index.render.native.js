// @flow
import React, {Component} from 'react'
import Container from '../../forms/container'
import type {Props} from './index.render'
import {Box, Checkbox, Button, Text, Icon} from '../../../common-adapters'
import {globalColors, globalStyles, globalMargins} from '../../../styles'
import {getStyle} from '../../../common-adapters/text'

/* types:
  paperkey: HiddenString,
  onFinish: () => void,
  onBack: () => void,
  title?: ?string
  */

type State = {
  checked: boolean,
}

class SuccessRender extends Component<void, Props, State> {
  state: State

  constructor(props: Props) {
    super(props)
    this.state = {
      checked: false,
    }
  }

  render() {
    return (
      <Container style={{flex: 1}}>
        <Text type="Header" style={textCenter}>
          {this.props.title || "Congratulations, you've just joined Keybase!"}
        </Text>
        <Text
          type="Body"
          style={{...textCenter, marginTop: globalMargins.medium}}
        >
          Here is your unique paper key, it will allow you to perform important Keybase tasks in the future. This is the only time you'll see this so be sure to write it down.
        </Text>

        <Box style={paperKeyContainerStyle}>
          <Text type="Header" style={paperkeyStyle}>
            {this.props.paperkey.stringValue()}
          </Text>
          <Box style={paperCornerStyle}>
            <Icon type="icon-paper-key-corner" />
          </Box>
        </Box>

        <Box style={confirmCheckboxStyle}>
          <Checkbox
            label="Yes, I wrote this down."
            checked={this.state.checked}
            onCheck={checked => this.setState({checked})}
          />
        </Box>

        <Box style={{flex: 2, justifyContent: 'flex-end'}}>
          <Button
            disabled={!this.state.checked}
            onClick={this.props.onFinish}
            label="Done"
            type="Primary"
          />
        </Box>
      </Container>
    )
  }
}

const confirmCheckboxStyle = {
  ...globalStyles.flexBoxRow,
  alignSelf: 'center',
  paddingBottom: globalMargins.small,
}

const textCenter = {
  textAlign: 'center',
}

const paperKeyContainerStyle = {
  alignSelf: 'center',
  marginTop: globalMargins.large,
  marginBottom: globalMargins.medium,
  paddingTop: globalMargins.small,
  paddingBottom: globalMargins.small,
  paddingLeft: globalMargins.small,
  paddingRight: globalMargins.large,
  borderRadius: 4,
  backgroundColor: globalColors.white,
  borderStyle: 'solid',
  borderWidth: 4,
  borderColor: globalColors.darkBlue,
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
