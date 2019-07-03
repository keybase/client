import React, {Component} from 'react'
import {Box, Button, Input, Icon} from '../common-adapters'
import {globalColors, globalStyles, desktopStyles, platformStyles} from '../styles'
import {defaultKBFSPath} from '../constants/config'

export type Props = {
  isPublic: boolean
  onAdded: (path: string) => void
  username: string | null
}

type State = {
  showingInput: boolean
  text: string
}

const UserButton = ({isPublic, onClick}: {isPublic: boolean; onClick: () => void}) => (
  <Box
    style={{
      ...stylesButtonContainer,
      backgroundColor: globalColors.white,
    }}
  >
    <Button
      small={true}
      onClick={onClick}
      labelStyle={{color: globalColors.white}}
      style={{
        backgroundColor: globalColors.blue,
      }}
      label={isPublic ? 'Open public folder' : 'New private folder'}
    />
  </Box>
)

type UserInputProps = {
  isPublic: boolean
  onSubmit: () => void
  onCancel: () => void
  onUpdateText: (text: string) => void
  username: string | null
  text: string
}

const UserInput = ({isPublic, onSubmit, onCancel, onUpdateText, username, text}: UserInputProps) => {
  return (
    <Box
      style={{
        ...stylesInputContainer,
        backgroundColor: globalColors.white,
      }}
    >
      <Input
        small={true}
        smallLabel={isPublic || !username ? '' : `${username},`}
        smallLabelStyle={{color: globalColors.blueDarker, marginRight: 0}}
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
      <Icon
        type={'iconfont-folder-open'}
        onClick={onSubmit}
        style={platformStyles({
          isElectron: desktopStyles.clickable,
        })}
        color={globalColors.blue}
      />
    </Box>
  )
}

class UserAdd extends Component<Props, State> {
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
    return this.state.showingInput ? (
      <UserInput
        onSubmit={() => this._submit()}
        text={this.state.text}
        onCancel={() => this._showInput(false)}
        onUpdateText={text => this.setState({text})}
        {...this.props}
      />
    ) : (
      <UserButton isPublic={this.props.isPublic} onClick={() => this._showInput(true)} {...this.props} />
    )
  }
}

const stylesButtonContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  flex: 1,
  height: 40,
  justifyContent: 'center',
  paddingLeft: 4,
  paddingRight: 4,
}

const stylesInputContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  flex: 1,
  height: 40,
  justifyContent: 'flex-start',
  overflow: 'hidden',
  paddingLeft: 6,
  paddingRight: 10,
}

export default UserAdd
