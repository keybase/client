// @flow
import React, {Component} from 'react'
import type {Props} from './user-add'
import type {IconType} from '../common-adapters/icon'
import {Box, Button, Input, Icon} from '../common-adapters'
import {globalColors, globalStyles} from '../styles'
import {defaultKBFSPath} from '../constants/config'

type State = {
  showingInput: boolean,
  text: string,
}

const UserButton = ({isPublic, onClick}: {isPublic: boolean, onClick: () => void}) => (
  <Box
    style={{
      ...stylesButtonContainer,
      backgroundColor: globalColors.white,
    }}
  >
    <Button
      type="Primary"
      small={true}
      onClick={onClick}
      labelStyle={{color: globalColors.white}}
      style={{
        backgroundColor: isPublic ? globalColors.yellowGreen : globalColors.darkBlue2,
      }}
      label={isPublic ? 'Open public folder' : 'New private folder'}
    />
  </Box>
)

const UserInput = ({isPublic, onSubmit, onCancel, onUpdateText, username, text}) => {
  const icon: IconType = isPublic ? 'icon-folder-public-open-32' : 'icon-folder-private-open-32'

  return (
    <Box
      style={{
        ...stylesInputContainer,
        backgroundColor: globalColors.white,
      }}
    >
      <Input
        small={true}
        smallLabel={isPublic ? '' : `${username},`}
        smallLabelStyle={{marginRight: 0}}
        hideUnderline={true}
        autoFocus={true}
        hintText={isPublic ? 'user or user1,user2,user3' : 'user1,user2,user3,...'}
        style={{flex: 1}}
        onChangeText={onUpdateText}
        value={text}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            onSubmit()
          } else if (event.key === 'Escape') {
            onCancel()
          }
        }}
      />
      <Icon type={icon} onClick={onSubmit} style={globalStyles.clickable} />
    </Box>
  )
}

class UserAdd extends Component<void, Props, State> {
  state: State

  constructor(props: Props) {
    super(props)

    this.state = {
      showingInput: false,
      text: '',
    }
  }

  _submit() {
    if (this.state.text) {
      this.props.onAdded(
        this.props.isPublic
          ? `${defaultKBFSPath}/public/${this.state.text}`
          : `${defaultKBFSPath}/private/${this.props.username || ''},${this.state.text}`
      )
    }
    this._showInput(false)
  }

  _showInput(showingInput: boolean) {
    this.setState({showingInput, text: ''})
  }

  render() {
    return this.state.showingInput
      ? <UserInput
          onSubmit={() => this._submit()}
          text={this.state.text}
          onCancel={() => this._showInput(false)}
          onUpdateText={text => this.setState({text})}
          {...this.props}
        />
      : <UserButton isPublic={this.props.isPublic} onClick={() => this._showInput(true)} {...this.props} />
  }
}

const stylesButtonContainer = {
  ...globalStyles.flexBoxColumn,
  justifyContent: 'center',
  paddingLeft: 4,
  paddingRight: 4,
  alignItems: 'center',
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

export default UserAdd
