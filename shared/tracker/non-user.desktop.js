// @flow

import React from 'react'
import {Box, Text, Button, Icon} from '../common-adapters'
import {globalColors, globalStyles} from '../styles/style-guide'

type Props = {
  name: string,
  reason: string,
  isPrivate: boolean,
  inviteLink: ?string,
  onClose: () => void
}

const Top = ({onClose, reason, inviteLink, name, isPrivate}) => {
  const message = inviteLink ? `You can message ${name} this link to skip the invitation queue:` : `Since you're out of invites, ${name} will need to request a signup on Keybase.io. Encourage them to join.`
  const icon = inviteLink ? 'invite-link-m' : isPrivate ? 'folder-private-success-m' : 'folder-public-success-m'
  const iconStyle = inviteLink ? {marginTop: 33, marginBottom: 16} : {marginTop: 24, marginBottom: 22}

  return (
    <Box style={stylesContainer}>
      <Icon style={stylesClose} type='fa-close' onClick={onClose}/>
      <Text type='BodySmallSemibold' style={stylesMessage}>{reason}</Text>
      <Icon style={iconStyle} type={icon}/>
      <Text type='BodySmallSemibold' style={stylesMessage}>{message}</Text>
      {inviteLink ? <Box style={stylesLinkBox}>
        <Icon type='link-xs'/>
        <Text style={stylesLink} type='BodySemibold'>{inviteLink}</Text>
      </Box> : <Box style={{height: 16}}/>}
    </Box>
  )
}

const Bottom = ({onClose, name}) => (
  <Box style={stylesNext}>
    <Text style={{marginBottom: 16}} type='Header'>What's next?</Text>
    <Box style={stylesBullet}>
      <Text type='BodySmall' style={{marginRight: 8}}>•</Text>
      <Text type='BodySmall'>When {name} connects Keybase and their Twitter account, your computer will verify them and rekey the folder.</Text>
    </Box>
    <Box style={{...stylesBullet, marginTop: 5}}>
      <Text type='BodySmall' style={{marginRight: 8}}>•</Text>
      <Text type='BodySmall'>In the meantime, you can continue to work in the folder.</Text>
    </Box>
    <Box style={{flex: 1}}/>
    <Button style={{alignSelf: 'flex-end', width: 122}} type='Secondary' label='Close' onClick={onClose}/>
  </Box>
)

const Render = ({name, reason, inviteLink, onClose, isPrivate}: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
    <Top reason={reason} isPrivate={isPrivate} inviteLink={inviteLink} name={name}/>
    <Bottom onClose={onClose} name={name}/>
  </Box>
)

const stylesMessage = {
  textAlign: 'center',
  color: globalColors.white,
  marginLeft: 24,
  marginRight: 24
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  position: 'relative',
  backgroundColor: globalColors.blue,
  padding: 16
}

const stylesClose = {
  position: 'absolute',
  right: 8,
  top: 8
}

const stylesLinkBox = {
  ...globalStyles.flexBoxRow,
  justifyContent: 'center',
  alignItems: 'center',
  alignSelf: 'stretch',
  marginTop: 8,
  borderRadius: 48,
  height: 32,
  backgroundColor: globalColors.white
}

const stylesLink = {
  ...globalStyles.selectable,
  marginLeft: 7,
  color: globalColors.green2
}

const stylesNext = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  backgroundColor: globalColors.white,
  alignItems: 'center',
  paddingTop: 24,
  paddingBottom: 16
}

const stylesBullet = {
  ...globalStyles.flexBoxRow,
  alignItems: 'flex-start',
  marginLeft: 32,
  marginRight: 32

}

export default Render
