// @flow
import React, {Component} from 'react'
import {Box, Text, Button, Input, PlatformIcon, StandardScreen} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles'
import {platformText} from './prove-enter-username.shared'

import type {PlatformsExpandedType} from '../constants/types/more'
import type {Props} from './prove-enter-username'

type State = {
  username: string,
}

function UsernameTips({platform}: {platform: PlatformsExpandedType}) {
  if (platform === 'hackernews') {
    return (
      <Box style={styleInfoBanner}>
        <Text backgroundMode="Information" type="BodySemibold">&bull; You must have karma &ge; 2</Text>
        <Text backgroundMode="Information" type="BodySemibold">
          &bull; You must enter your uSeRName with exact case
        </Text>
      </Box>
    )
  }

  return null
}

function customError(error: string, code: ?number) {
  return <Text style={styleErrorBannerText} type="BodySemibold">{error}</Text>
}

class PrivateEnterUsernameRender extends Component<void, Props, State> {
  state = {
    username: '',
  }

  handleUsernameChange(username: string) {
    if (this.props.onUsernameChange) {
      this.props.onUsernameChange(username)
    }
    this.setState({username})
  }

  handleContinue() {
    this.props.onContinue(this.state.username)
  }

  render() {
    const {floatingLabelText, hintText} = platformText[this.props.platform]
    const notification = this.props.errorText
      ? {notification: {type: 'error', message: customError(this.props.errorText, this.props.errorCode)}}
      : {}
    return (
      <StandardScreen {...notification} onCancel={this.props.onCancel}>
        <PlatformIcon
          style={styleIcon}
          platform={this.props.platform}
          overlay={'icon-proof-pending'}
          overlayColor={globalColors.grey}
        />
        <Input
          style={styleInput}
          autoFocus={true}
          floatingHintTextOverride={floatingLabelText}
          hintText={hintText}
          value={this.state.username}
          onChangeText={username => this.handleUsernameChange(username)}
          onEnterKeyDown={() => this.handleContinue()}
        />
        <UsernameTips platform={this.props.platform} />
        <Button
          style={styleButton}
          type="Primary"
          fullWidth={true}
          disabled={!this.props.canContinue}
          onClick={() => this.handleContinue()}
          label="Continue"
        />
      </StandardScreen>
    )
  }
}

const styleErrorBannerText = {
  color: globalColors.white,
}

const styleIcon = {
  alignSelf: 'center',
}

const styleInput = {
  marginBottom: 0,
  marginTop: globalMargins.large,
}

const styleInfoBanner = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'flex-start',
  backgroundColor: globalColors.yellow,
  paddingTop: globalMargins.tiny,
  paddingBottom: globalMargins.tiny,
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
  marginTop: globalMargins.large,
  marginLeft: -globalMargins.medium,
  marginRight: -globalMargins.medium,
}

const styleButton = {
  marginTop: globalMargins.large,
  marginBottom: globalMargins.large,
}

export default PrivateEnterUsernameRender
