// @flow
import React, {Component} from 'react'
import {platformText} from './prove-enter-username.shared'
import {Box, Icon, Text, Button, Input, PlatformIcon} from '../common-adapters'
import {constants} from '../constants/types/keybase-v1'
import {globalStyles, globalColors, globalMargins} from '../styles/style-guide'
import openURL from '../util/open-url'

import type {PlatformsExpandedType} from '../constants/types/more'
import type {Props} from './prove-enter-username'

type State = {
  username: string
}

function UsernameTips ({platform}: {platform: PlatformsExpandedType}) {
  if (platform === 'hackernews') {
    return (
      <Box style={styleInfoBanner}>
        <Text backgroundMode='Information' type='BodySmallSemibold'>&bull; You must have karma &ge; 2</Text>
        <Text backgroundMode='Information' type='BodySmallSemibold'>&bull; You must enter your uSeRName with exact case</Text>
      </Box>
    )
  }

  return null
}

function customError (error: string, code: ?number) {
  if (code === constants.StatusCode.scprofilenotpublic) {
    return <Box style={{...globalStyles.flexBoxColumn, justifyContent: 'center', alignItems: 'center'}}>
      <Text style={{...styleErrorBannerText, marginLeft: globalMargins.small, marginRight: globalMargins.small}} type='BodySmallSemibold'>You haven't set a public "Coinbase URL". You need to do that now.</Text>
      <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}} onClick={() => openURL('https://www.coinbase.com/settings#payment_page')}>
        <Text style={styleErrorBannerText} type='BodySmallSemibold'>Go to Coinbase</Text>
        <Icon type='iconfont-open-browser' style={{color: globalColors.white_40, marginLeft: 4}} />
      </Box>
    </Box>
  }
  return <Text style={styleErrorBannerText} type='BodySmallSemibold'>{error}</Text>
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
      <Box style={styleContainer}>
        <Box style={styleCancel}>
          <Text type='BodyPrimaryLink' style={{position: 'absolute', top: 0, color: globalColors.blue}} onClick={this.props.onCancel}>Cancel</Text>
        </Box>
        {this.props.errorText && <Box style={styleErrorBanner}>{customError(this.props.errorText, this.props.errorCode)}</Box>}
        <PlatformIcon style={{marginTop: globalMargins.medium}} platform={this.props.platform} overlay={'icon-proof-pending'} overlayColor={globalColors.grey} size={48} />
        <Input
          style={styleInput}
          autoFocus={true}
          floatingLabelText={floatingLabelText}
          hintText={hintText}
          value={this.state.username}
          onChangeText={username => this.handleUsernameChange(username)}
          onEnterKeyDown={() => this.handleContinue()} />
        <UsernameTips platform={this.props.platform} />
        <Button
          style={styleButton}
          fullWidth={true}
          type='Primary'
          disabled={!this.props.canContinue}
          onClick={() => this.handleContinue()}
          label='Continue' />
      </Box>
    )
  }
}

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  alignItems: 'center',
}

const styleCancel = {
  ...globalStyles.flexBoxRow,
  alignSelf: 'flex-start',
  marginLeft: globalMargins.small,
  marginBottom: globalMargins.medium,
}

const styleErrorBanner = {
  ...globalStyles.flexBoxColumn,
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: globalMargins.large,
  backgroundColor: globalColors.red,
}

const styleErrorBannerText = {
  color: globalColors.white,
}

const styleInput = {
  alignSelf: 'stretch',
  marginBottom: 0,
  marginLeft: globalMargins.small,
  marginRight: globalMargins.small,
  marginTop: globalMargins.large,
}

const styleInfoBanner = {
  ...globalStyles.flexBoxColumn,
  alignSelf: 'stretch',
  alignItems: 'flex-start',
  backgroundColor: globalColors.yellow,
  padding: globalMargins.small,
  marginTop: globalMargins.large,
}

const styleButton = {
  alignSelf: 'stretch',
  marginLeft: globalMargins.small,
  marginRight: globalMargins.small,
  marginTop: globalMargins.large,
}

export default Render
