import React, {Component} from 'react'
import type {Props} from './user-add'
import {Box, Button, Input, Icon, Text} from '../common-adapters'
import {globalColors, globalStyles} from '../styles/style-guide'

type State = {
  showingInput: boolean,
  text: string
}

const UserButton = ({isPublic, onClick}: Props) => (
  <Box style={{...stylesButtonContainer,
    backgroundColor: isPublic ? globalColors.white : globalColors.darkBlue,
  }}>
    <Button
      fullWidth
      small
      onClick={onClick}
      labelStyle={{color: globalColors.white}}
      style={{
        backgroundColor: isPublic ? globalColors.yellowGreen : globalColors.darkBlue2}}
      label={isPublic ? 'Open public folder' : 'New private folder'} />
  </Box>
)

const UserInput = ({isPublic, onSubmit, onCancel, onUpdateText, username}) => (
  <Box style={{...stylesInputContainer,
    backgroundColor: isPublic ? globalColors.lightGrey : globalColors.darkBlue3,
  }}>
    {!isPublic && <Text type='BodySemiboldItalic' style={stylesPrivatePrefix}>{username},</Text>}
    <Input
      small
      autoFocus
      hintText={isPublic ? 'user or user1,user2,user3' : 'user1,user2,user3,...'}
      hintStyle={{...stylesInputHint, color: isPublic ? globalColors.black_20 : globalColors.white_40}}
      style={stylesInput}
      inputStyle={{...stylesInputInput, color: isPublic ? globalColors.black_75 : globalColors.white}}
      underlineStyle={stylesInputUnderline}
      onChangeText={onUpdateText}
      onKeyDown={event => {
        if (event.key === 'Enter') {
          onSubmit()
        } else if (event.key === 'Escape') {
          onCancel()
        }
      }} />
    <Icon type={`folder-${isPublic ? 'public' : 'private'}-open-32`} onClick={onSubmit} style={{...globalStyles.clickable}} />
  </Box>
)

class UserAdd extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)

    this.state = {
      showingInput: false,
      text: '',
    }
  }

  _submit () {
    if (this.state.text) {
      this.props.onAdded(this.props.isPublic
        ? `/keybase/public/${this.state.text}`
        : `/keybase/private/${this.props.username},${this.state.text}`)
    }
    this._showInput(false)
  }

  _showInput (showingInput: boolean) {
    this.setState({showingInput, text: ''})
  }

  render () {
    return this.state.showingInput
      ? <UserInput
        onSubmit={() => this._submit()}
        onCancel={() => this._showInput(false)}
        onUpdateText={text => this.setState({text})}
        {...this.props} />
      : <UserButton
        onClick={() => this._showInput(true)}
        {...this.props} />
  }
}

const stylesButtonContainer = {
  ...globalStyles.flexBoxColumn,
  justifyContent: 'center',
  paddingLeft: 4,
  paddingRight: 4,
  alignItems: 'stretch',
  flex: 1,
  height: 40,
  borderTop: `solid 1px ${globalColors.black_10}`,
}

const stylesInputContainer = {
  ...globalStyles.flexBoxRow,
  justifyContent: 'flex-start',
  paddingLeft: 6,
  paddingRight: 10,
  alignItems: 'center',
  flex: 1,
  height: 40,
}

const stylesInput = {
  flex: 1,
  height: 20,
}

const stylesInputInput = {
  ...globalStyles.fontSemibold,
  fontSize: 14,
  textAlign: 'left',
}

const stylesInputHint = {
  ...globalStyles.fontSemibold,
  fontSize: 14,
  textAlign: 'left',
  marginTop: 1,
}

const stylesInputUnderline = {
  display: 'none',
}

const stylesPrivatePrefix = {
  ...globalStyles.fontSemibold,
  color: globalColors.white,
  fontSize: 14,
  marginRight: 2,
  marginTop: 2,
}

export default UserAdd
