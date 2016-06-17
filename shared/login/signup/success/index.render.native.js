/* @flow */
/* eslint-disable react/prop-types */

import React, {Component} from 'react'
import {globalColors, globalStyles} from '../../../styles/style-guide'
import {Box, Checkbox, Button, Text, Icon} from '../../../common-adapters'
import {specialStyles} from '../../../common-adapters/text'

import type {Props} from './index.render'

/* types:
  paperkey: HiddenString,
  onFinish: () => void,
  onBack: () => void,
  title?: ?string
  */

type State = {
  checked: boolean
}

export default class Render extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)
    this.state = {
      checked: false,
    }
  }

  render () {
    return (
      <Box style={{padding: 32, flex: 1}}>
        <Text type='Header' style={textCenter}>{this.props.title || 'Congratulations, you’ve just joined Keybase!'}</Text>
        <Text type='BodySmall' style={{...textCenter, marginTop: 7}}>Here is your unique paper key, it will allow you to perform important Keybase tasks in the future. This is the only time you’ll see this so be sure to write it down.</Text>

        <Box style={paperKeyContainerStyle}>
          <Text type='Body' style={paperkeyStyle}>{this.props.paperkey.stringValue()}</Text>
          <Icon type='paper-key-corner' style={paperCornerStyle} />
        </Box>

        <Box style={confirmCheckboxStyle}>
          <Checkbox
            label='Yes, I wrote this down.'
            checked={this.state.checked}
            onCheck={checked => this.setState({checked})} />
        </Box>

        <Box style={{flex: 2, justifyContent: 'flex-end'}}>
          <Button style={buttonStyle}
            disabled={!this.state.checked}
            onClick={this.props.onFinish}
            label='Done'
            type='Primary' />
        </Box>
      </Box>
    )
  }
}

const confirmCheckboxStyle = {
  ...globalStyles.flexBoxRow,
  alignSelf: 'center',
}

const buttonStyle = {
}

const textCenter = {
  textAlign: 'center',
}

const paperKeyContainerStyle = {
  position: 'relative',
  alignSelf: 'center',
  marginTop: 32,
  marginBottom: 65,
  padding: 32,
  borderRadius: 1,
  backgroundColor: globalColors.white,
  borderStyle: 'solid',
  borderWidth: 4,
  borderColor: globalColors.darkBlue,
}

const paperkeyStyle = {
  ...specialStyles.paperKey,
}

const paperCornerStyle = {
  position: 'absolute',
  right: 0,
  top: -4,
}
