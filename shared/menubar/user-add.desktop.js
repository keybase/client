// @flow
import React, {Component} from 'react'
import type {Props} from './user-add'
import type {IconType} from '../common-adapters/icon'
import {Box, Button, Input, Icon, Text} from '../common-adapters'
import {globalColors, globalStyles} from '../styles'
import {defaultKBFSPath} from '../constants/config'

type State = {
  showingInput: boolean,
  text: string,
}

const UserButton = ({isPublic, onClick}: {isPublic: boolean, onClick: () => void}) => (
  <Box style={{...stylesButtonContainer,
    backgroundColor: isPublic ? globalColors.white : globalColors.darkBlue}}>
    <Button
      type='Primary'
      small={true}
      onClick={onClick}
      labelStyle={{color: globalColors.white}}
      style={{
        backgroundColor: isPublic ? globalColors.yellowGreen : globalColors.darkBlue2}}
      label={isPublic ? 'Open public folder' : 'New private folder'} />
  </Box>
)

const UserInput = ({isPublic, onSubmit, onCancel, onUpdateText, username}) => {
  const icon: IconType = isPublic ? 'icon-folder-public-open-32' : 'icon-folder-private-open-32'

  return (
    <Box style={{...stylesInputContainer,
      backgroundColor: isPublic ? globalColors.lightGrey : globalColors.darkBlue3}}>
      {!isPublic && <Text type='BodySemiboldItalic' style={stylesPrivatePrefix}>{username},</Text>}
      <Input
        small={true}
        autoFocus={true}
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
      <Icon type={icon} onClick={onSubmit} style={{...globalStyles.clickable}} />
    </Box>
  )
}

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
        ? `${defaultKBFSPath}/public/${this.state.text}`
        : `${defaultKBFSPath}/private/${this.props.username || ''},${this.state.text}`)
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
        isPublic={this.props.isPublic}
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
}

const stylesInputContainer = {
  ...globalStyles.flexBoxRow,
  justifyContent: 'flex-start',
  paddingLeft: 6,
  paddingRight: 10,
  alignItems: 'center',
  flex: 1,
  height: 40,
  overflow: 'hidden',
}

const stylesInput = {
  flex: 1,
  marginTop: 12,
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
  marginBottom: 2,
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
