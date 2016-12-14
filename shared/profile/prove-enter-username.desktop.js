// @flow
import React from 'react'
import openURL from '../util/open-url'
import {Box, Icon, Text, Button, Input, PlatformIcon} from '../common-adapters'
import {ConstantsStatusCode} from '../constants/types/flow-types'
import {checkBTC, checkZcash} from '../constants/profile'
import {compose, withHandlers, withState} from 'recompose'
import {globalStyles, globalColors, globalMargins} from '../styles'
import {platformText} from './prove-enter-username.shared'

import type {PlatformsExpandedType} from '../constants/types/more'
import type {Props} from './prove-enter-username'

const UsernameTips = ({platform}: {platform: PlatformsExpandedType}) => (
  (platform === 'hackernews')
  ? (
    <Box style={styleInfoBanner}>
      <Text backgroundMode='Information' type='BodySemibold'>
        &bull; You must have karma &ge; 2<br />
        &bull; You must enter your uSeRName with exact case
      </Text>
    </Box>
  ) : null
)

const customError = (error: string, code: ?number) => (
  (code === ConstantsStatusCode.scprofilenotpublic)
  ? (
    <Box style={{...globalStyles.flexBoxColumn, justifyContent: 'center', alignItems: 'center'}}>
      <Text style={styleErrorBannerText} type='BodySemibold'>You haven't set a public "Coinbase URL". You need to do that now.</Text>
      <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}} onClick={() => openURL('https://www.coinbase.com/settings#payment_page')}>
        <Text style={styleErrorBannerText} type='BodySemibold'>Go to Coinbase</Text>
        <Icon type='iconfont-open-browser' style={{color: globalColors.white_40, marginLeft: 4}} />
      </Box>
    </Box>
  ) : <Text style={styleErrorBannerText} type='BodySemibold'>{error}</Text>
)

const ProveEnterUsername = (props: Props) => {
  const {headerText, floatingLabelText, hintText} = platformText[props.platform]

  return (
    <Box style={styleContainer}>
      <Icon style={styleClose} type='iconfont-close' onClick={props.onCancel} />
      {props.errorText && <Box style={styleErrorBanner}>{customError(props.errorText, props.errorCode)}</Box>}
      <Text type='Header' style={{marginBottom: globalMargins.medium}}>{headerText}</Text>
      <PlatformIcon platform={props.platform} overlay={'icon-proof-unfinished'} overlayColor={globalColors.grey} />
      <Input
        autoFocus={true}
        style={styleInput}
        floatingHintTextOverride={floatingLabelText}
        hintText={hintText}
        value={props.username}
        onChangeText={props.onUsernameChange}
        onEnterKeyDown={props.onContinue} />
      <UsernameTips platform={props.platform} />
      <Box style={{...globalStyles.flexBoxRow, marginTop: 32}}>
        <Button type='Secondary' onClick={props.onCancel} label='Cancel' />
        <Button type='Primary' disabled={!props.canContinue} onClick={props.onContinue} label='Continue' />
      </Box>
    </Box>
  )
}

const styleErrorBanner = {
  ...globalStyles.flexBoxColumn,
  justifyContent: 'center',
  position: 'absolute',
  alignItems: 'center',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 1,
  minHeight: globalMargins.large,
  backgroundColor: globalColors.red,
}

const styleErrorBannerText = {
  color: globalColors.white,
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
  alignSelf: 'center',
  marginTop: globalMargins.small,
  marginBottom: 0,
  width: 460,
}

const styleInfoBanner = {
  ...globalStyles.flexBoxColumn,
  alignSelf: 'stretch',
  alignItems: 'center',
  backgroundColor: globalColors.yellow,
  padding: globalMargins.tiny,
}

export default compose(
  withState('username', 'setUsername', props => props.username),
  withState('canContinue', 'setCanContinue', props => props.canContinue),
  withHandlers({
    onUsernameChange: props => (username: string) => {
      props.setUsername(username)
      if (props.platform === 'btc') {
        props.setCanContinue(checkBTC(username))
      } else if (props.platform === 'zcash') {
        props.setCanContinue(checkZcash(username))
      }
    },
    onContinue: props => () => props.onContinue(props.username),
  }),
)(ProveEnterUsername)
