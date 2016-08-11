// @flow
import React, {Component} from 'react'
import {platformText} from './prove-enter-username.shared'
import {Box, Icon, Text, Button, Input, PlatformIcon} from '../common-adapters'
import {constants} from '../constants/types/keybase-v1'
import {globalStyles, globalColors, globalMargins} from '../styles/style-guide'

import type {PlatformsExpandedType} from '../constants/types/more'
import type {Props} from './prove-enter-username'

type State = {
  username: string
}

function UsernameTips ({platform}: {platform: PlatformsExpandedType}) {
  if (platform === 'hackernews') {
    return (
      <Box>
        <Text backgroundMode='Information' type='BodySmall'>
          &bull; You must have karma &ge; 2<br />
          &bull; You must enter your uSeRName with exact case
        </Text>
      </Box>
    )
  }

  return null
}

function customError (error: string, code: ?number) {
  if (code === constants.StatusCode.scprofilenotpublic) {
    return <Box style={{...globalStyles.flexBoxColumn, justifyContent: 'center', alignItems: 'center'}}>
      <Text type='BodySmallSemibold'>You haven't set a public "Coinbase URL". You need to do that now.</Text>
    </Box>
  }
  return <Text type='BodySmallSemibold'>{error}</Text>
}

class Render extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)
    this.state = {
      username: '',
    }
  }

  handleUsernameChange (username: string) {
    if (this.props.onUsernameChange) {
      this.props.onUsernameChange(username)
    }
    this.setState({username})
  }

  handleContinue () {
    this.props.onContinue(this.state.username)
  }

  render () {
    const {floatingLabelText, hintText} = platformText[this.props.platform]
    return (
      <Box>
        <Icon type='iconfont-close' onClick={this.props.onCancel} />
        {this.props.errorText && <Box>{customError(this.props.errorText, this.props.errorCode)}</Box>}
        <PlatformIcon platform={this.props.platform} overlay={'icon-proof-pending'} overlayColor={globalColors.grey} size={48} />
        <Input
          autoFocus={true}
          floatingLabelText={floatingLabelText}
          hintText={hintText}
          value={this.state.username}
          onChangeText={username => this.handleUsernameChange(username)}
          onEnterKeyDown={() => this.handleContinue()} />
        <UsernameTips platform={this.props.platform} />
        <Box style={{...globalStyles.flexBoxRow, marginTop: 32}}>
          <Button type='Secondary' onClick={this.props.onCancel} label='Cancel' />
          <Button type='Primary' disabled={!this.props.canContinue} onClick={() => this.handleContinue()} label='Continue' />
        </Box>
      </Box>
    )
  }
}

export default Render
