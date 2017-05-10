// @flow
import React from 'react'
import {Box, Text, Button, Icon} from '../common-adapters'
import {globalColors, globalStyles} from '../styles'
import type {Props} from './non-user'

const Top = ({onClose, reason, inviteLink, name, isPrivate}) => {
  const message = inviteLink
    ? `You can send ${name} this link to skip the invitation queue:`
    : `Since you're out of invites, ${name} will need to request a signup on Keybase.io. Encourage them to join.`
  const icon = inviteLink
    ? 'icon-invite-link-negative-48'
    : isPrivate
        ? 'icon-folder-private-success-negative-48'
        : 'icon-folder-public-success-negative-48'

  let textRef
  return (
    <Box style={stylesContainer}>
      <Icon style={stylesClose} type="iconfont-close" onClick={onClose} />
      <Text type="BodySemibold" style={stylesMessage}>{reason}</Text>
      <Icon type={icon} />
      <Box style={globalStyles.flexBoxColumn}>
        <Text
          type="Body"
          style={{
            ...stylesMessage,
            ...(inviteLink ? {} : {marginBottom: 16}),
          }}
        >
          {message}
        </Text>
        {inviteLink &&
          <Box style={stylesLinkBox}>
            <Icon
              style={{color: globalColors.black_10, marginTop: 3}}
              type="iconfont-link"
              onClick={() => textRef && textRef.highlightText()}
            />
            <Text
              allowHighlightText={true}
              ref={r => {
                textRef = r
              }}
              style={stylesLink}
              type="BodySemibold"
            >
              {inviteLink}
            </Text>
          </Box>}
      </Box>
    </Box>
  )
}

const Bottom = ({onClose, name, serviceName}) => (
  <Box style={stylesNext}>
    <Text style={{marginBottom: 16}} type="Header">What's next?</Text>
    <Box style={stylesBullet}>
      <Text type="Body" style={{marginRight: 8}}>•</Text>
      <Text type="Body">
        When
        {' '}
        {name}
        {' '}
        connects Keybase and their
        {' '}
        {serviceName || 'other'}
        {' '}
        account, your computer will verify them and rekey the folder.
      </Text>
    </Box>
    <Box style={{...stylesBullet, marginTop: 5}}>
      <Text type="Body" style={{marginRight: 8}}>•</Text>
      <Text type="Body">
        In the meantime, you can continue to work in the folder.
      </Text>
    </Box>
    <Box style={{flex: 1, alignItems: 'center'}} />
    <Button
      style={{width: 122}}
      type="Secondary"
      label="Close"
      onClick={onClose}
    />
  </Box>
)

const Render = ({
  name,
  reason,
  inviteLink,
  onClose,
  isPrivate,
  serviceName,
}: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
    <Top
      onClose={onClose}
      reason={reason}
      isPrivate={isPrivate}
      inviteLink={inviteLink}
      name={name}
    />
    <Bottom onClose={onClose} name={name} serviceName={serviceName} />
  </Box>
)

const stylesMessage = {
  textAlign: 'center',
  color: globalColors.white,
  marginLeft: -5, // give a little breathing room
  marginRight: -5,
}

const stylesContainer = {
  ...globalStyles.windowDragging,
  ...globalStyles.flexBoxColumn,
  justifyContent: 'space-between',
  cursor: 'default',
  alignItems: 'center',
  position: 'relative',
  backgroundColor: globalColors.blue,
  height: 235,
  padding: 24,
}

const stylesClose = {
  ...globalStyles.windowDraggingClickable,
  position: 'absolute',
  right: 8,
  top: 8,
}

const stylesLinkBox = {
  ...globalStyles.flexBoxRow,
  justifyContent: 'center',
  alignItems: 'center',
  alignSelf: 'stretch',
  marginTop: 8,
  borderRadius: 48,
  height: 32,
  backgroundColor: globalColors.white,
}

const stylesLink = {
  ...globalStyles.selectable,
  ...globalStyles.windowDraggingClickable,
  marginLeft: 7,
  color: globalColors.green2,
}

const stylesNext = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  backgroundColor: globalColors.white,
  alignItems: 'center',
  padding: 24,
}

const stylesBullet = {
  ...globalStyles.flexBoxRow,
  alignItems: 'flex-start',
}

export default Render
