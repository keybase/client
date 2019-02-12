// @flow
import React, {Component} from 'react'
import {Linking} from 'react-native'
import {Box, Box2, Text, Button, InfoNote, Input, PlatformIcon, StandardScreen} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {platformText} from './shared'
import type {PlatformsExpandedType} from '../../constants/types/more'
import type {Props} from '.'

type State = {
  username: string,
}

function UsernameTips({platform}: {platform: PlatformsExpandedType}) {
  if (platform === 'hackernews') {
    return (
      <Box style={styleYellowBanner}>
        <Text backgroundMode="Information" type="BodySmallSemibold">
          &bull; You must have karma &ge; 2
        </Text>
        <Text backgroundMode="Information" type="BodySmallSemibold">
          &bull; You must enter your uSeRName with exact case
        </Text>
      </Box>
    )
  }

  if (platform === 'facebook') {
    return (
      <InfoNote>
        <Box2 direction="vertical">
          <Text center={true} type="BodySmall">
            You can find your Facebook username at
          </Text>
          <Box2 direction="horizontal">
            <Text
              center={true}
              type="BodySmallSecondaryLink"
              onClick={() => Linking.openURL('http://www.facebook.com/settings')}
            >
              http://www.facebook.com/settings
            </Text>
            <Text type="BodySmall">.</Text>
          </Box2>
        </Box2>
      </InfoNote>
    )
  }

  return null
}

function customError(error: string, code: ?number) {
  return (
    <Text style={styleErrorBannerText} type="BodySemibold">
      {error}
    </Text>
  )
}

class PrivateEnterUsernameRender extends Component<Props, State> {
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
    const pt = platformText[this.props.platform]
    if (!pt) {
      // TODO support generic proofs
      throw new Error(`Proofs for platform ${this.props.platform} are unsupported.`)
    }
    const {floatingLabelText, hintText} = pt
    const notification = this.props.errorText
      ? {notification: {message: customError(this.props.errorText, this.props.errorCode), type: 'error'}}
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

// FIXME: this is the old way (#styles)

const styleErrorBannerText = {
  color: globalColors.white,
}

const styleIcon = {
  alignSelf: 'center',
  marginTop: globalMargins.mediumLarge,
}

const styleInput = {
  marginBottom: 0,
  marginTop: globalMargins.mediumLarge,
}

const styleYellowBanner = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'flex-start',
  backgroundColor: globalColors.yellow,
  marginBottom: -globalMargins.medium,
  marginLeft: -globalMargins.medium,
  marginRight: -globalMargins.medium,
  marginTop: globalMargins.large,
  paddingBottom: globalMargins.tiny,
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
  paddingTop: globalMargins.tiny,
}

const styleButton = {
  marginBottom: globalMargins.large,
  marginTop: globalMargins.large,
}

export default PrivateEnterUsernameRender
