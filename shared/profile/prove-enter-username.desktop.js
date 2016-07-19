// @flow
import React, {Component} from 'react'
import {Box, Icon, Text, Button, Input, PlatformIcon} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles/style-guide'
import type {Platforms} from '../constants/types/more'
import type {Props} from './prove-enter-username'

const platformText : {[key: Platforms | 'btc']: {headerText: string, floatingLabelText?: string, hintText?: string}} = {
  'twitter': {
    headerText: 'Prove your Twitter identity',
    floatingLabelText: 'Your Twitter username',
  },
  'reddit': {
    headerText: 'Prove your Reddit identity',
    floatingLabelText: 'Your Reddit username',
  },
  'github': {
    headerText: 'Prove your GitHub identity',
    floatingLabelText: 'Your GitHub username',
  },
  'coinbase': {
    headerText: 'Prove your Coinbase identity',
    floatingLabelText: 'Your Coinbase username',
  },
  'hackernews': {
    headerText: 'Prove your Hacker News identity',
    floatingLabelText: 'Your Hacker News username',
  },
  'btc': {
    headerText: 'Set a Bitcoin address',
    floatingLabelText: 'Your Bitcoin address',
  },
  'dns': {
    headerText: 'Prove your domain',
    hintText: 'yourdomain.com',
  },
  'genericWebSite': {
    headerText: 'Prove your website',
    hintText: 'whatever.yoursite.com',
  },
}

type State = {
  username: string
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

  _usernameTips () {
    if (this.props.platform === 'hackernews') {
      return (
        <Box style={styleInfoBanner}>
          <Text backgroundMode='Information' type='BodySmall'>
            &bull; You must have karma &ge; 2<br />
            &bull; You must enter your uSeRName with exact case
          </Text>
        </Box>
      )
    }
  }

  render () {
    const {headerText, floatingLabelText, hintText} = platformText[this.props.platform]
    // FIXME: Input component has extra bottom space when no floating text.
    // This adjusts the sizes to be equal, but we should fix this discrepancy
    // in the component.
    let inputSizeFix = {}
    if (!floatingLabelText) {
      inputSizeFix = {textStyle: {height: 40, marginTop: 29, marginBottom: 11}}
    }

    return (
      <Box style={styleContainer}>
        <Icon style={styleClose} type='iconfont-close' onClick={this.props.onCancel} />
        <Text type='Header' style={{marginBottom: globalMargins.medium}}>{headerText}</Text>
        {/* FIXME: awaiting blank icon overlay art here */}
        <PlatformIcon platform={this.props.platform} overlay={'iconfont-proof-pending'} overlayColor={globalColors.grey} size={48} />
        <Input style={styleInput} {...inputSizeFix} floatingLabelText={floatingLabelText} hintText={hintText} value={this.state.username} onChangeText={username => this.handleUsernameChange(username)} onEnterKeyDown={() => this.handleContinue()} />
        {this._usernameTips()}
        <Box style={{...globalStyles.flexBoxRow, marginTop: 32}}>
          <Button type='Secondary' onClick={this.props.onCancel} label='Cancel' />
          <Button type='Primary' disabled={!this.props.canContinue} onClick={() => this.handleContinue()} label='Continue' />
        </Box>
      </Box>
    )
  }
}

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  position: 'relative',
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
}

const styleClose = {
  ...globalStyles.clickable,
  position: 'absolute',
  right: 16,
  top: 16,
}

const styleInput = {
  alignSelf: 'stretch',
  marginLeft: 90,
  marginRight: 90,
  marginTop: globalMargins.small,
  marginBottom: 0,
}

const styleInfoBanner = {
  ...globalStyles.flexBoxColumn,
  alignSelf: 'stretch',
  alignItems: 'center',
  backgroundColor: globalColors.yellow,
  padding: globalMargins.tiny,
}

export default Render
