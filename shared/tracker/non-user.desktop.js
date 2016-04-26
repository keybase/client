// @flow

import React from 'react'
import {Box, Text, Button, Icon} from '../common-adapters'
import {globalColors, globalStyles} from '../styles/style-guide'

type Props = {
  name: string,
  reason: string,
  inviteLink: ?string,
  onClose: () => void
}

const Render = ({name, reason, inviteLink, onClose}: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
    <Box style={stylesContainer}>
      <Icon style={stylesClose} type='fa-close' onClick={onClose}/>
      <Text type='BodySmallSemibold' style={stylesMessage}>{reason}</Text>
      <Icon style={stylesIcon} type='invite-link-m'/>
      <Text type='BodySmallSemibold' style={stylesMessage}>You can message {name} this link to skip the invitation queue:</Text>
      <Box style={stylesLinkBox}>
        <Icon type='fa-link'/>
        <Text style={stylesLink} type='BodySemibold'>{inviteLink}</Text>
      </Box>
    </Box>
    <Box style={stylesNext}>
      <Text style={{marginBottom: 16}} type='Header'>What's next?</Text>
      <Box style={stylesBullet}>
        <Text type='BodySmall' style={{marginRight: 8}}>•</Text>
        <Text type='BodySmall'>When {name} connects Keybase and their Twitter account, your computer will verify them and rekey the folder.</Text>
      </Box>
      <Box style={{...stylesBullet, marginTop: 5}}>
        <Text type='BodySmall' style={{marginRight: 8}}>•</Text>
        <Text type='BodySmall'>In the meantime, you can continue writing sketchy shit in the folder.</Text>
      </Box>
      <Box style={{flex: 1}}/>
      <Button style={{alignSelf: 'flex-end', width: 122}} type='Secondary' label='Close' onClick={onClose}/>
    </Box>
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

const stylesIcon = {
  marginTop: 33,
  marginBottom: 16
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
