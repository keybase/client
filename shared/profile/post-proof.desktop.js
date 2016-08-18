// @flow
import React from 'react'
import {Box, Text, Button, Icon, PlatformIcon} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles/style-guide'
import * as shared from './post-proof.shared'
import type {Props} from './post-proof'
import {clipboard} from 'electron'

const Render = (props: Props) => {
  const {
    platform, platformUserName, descriptionText, proofAction, onCancel,
    onCancelText, onComplete, isOnCompleteWaiting, errorMessage,
  } = props
  const {
    descriptionView, noteText, onCompleteText, proofText, platformSubtitle, proofActionIcon, proofActionText,
  } = shared.propsForPlatform(props)

  return (
    <Box style={styleContainer} onCopyCapture={(e) => {
      // disallow copying the whole screen by accident
      e.preventDefault()
      clipboard.writeText(proofText)
    }}>
      <Icon style={styleClose} type='iconfont-close' onClick={() => onCancel()} />
      {errorMessage && <Box style={styleErrorBanner}><Text style={styleErrorBannerText} type='BodySmallSemibold'>{errorMessage}</Text></Box>}
      <Box style={styleContentContainer}>
        <PlatformIcon platform={platform} overlay='icon-proof-unfinished' overlayColor={globalColors.grey} />
        <Text style={{...stylePlatformUsername, ...(stylePlatformSubtitle ? {} : {marginBottom: globalMargins.medium})}} type='Header'>{platformUserName}</Text>
        {platformSubtitle && <Text style={stylePlatformSubtitle} type='Body'>{platformSubtitle}</Text>}
        {descriptionView || (descriptionText && <Text type='Body'>{descriptionText}</Text>)}
        {proofText && <textarea style={styleProofText} readOnly={true} value={proofText} />}
        {noteText && <Text style={styleNoteText} type='BodySmall'>{noteText}</Text>}
        {proofAction && proofActionText &&
          <Text style={styleProofAction} type='BodyPrimaryLink' onClick={() => proofAction()}>{proofActionIcon && <Icon style={styleProofActionIcon} type={proofActionIcon} />}{proofActionText}</Text>}
        <Box style={styleButtonsContainer}>
          {onCancelText && <Button type='Secondary' onClick={() => onCancel()} label={onCancelText || 'Cancel'} />}
          <Button type='Primary' onClick={() => onComplete()} label={onCompleteText} waiting={isOnCompleteWaiting} />
        </Box>
      </Box>
    </Box>
  )
}

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  alignItems: 'center',
  position: 'relative',
  paddingTop: globalMargins.large,
  paddingBottom: globalMargins.large,
  ...globalStyles.scrollable,
}

const styleClose = {
  position: 'absolute',
  top: globalMargins.small,
  right: globalMargins.small,
  ...globalStyles.clickable,
  color: globalColors.black_10,
}

const styleErrorBanner = {
  ...globalStyles.flexBoxColumn,
  justifyContent: 'center',
  alignItems: 'center',
  width: '100%',
  zIndex: 1,
  minHeight: globalMargins.large,
  padding: globalMargins.tiny,
  marginTop: -globalMargins.large,
  backgroundColor: globalColors.red,
}

const styleErrorBannerText = {
  color: globalColors.white,
  maxWidth: 512,
  textAlign: 'center',
}

const styleContentContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  margin: globalMargins.large,
  maxWidth: 512,
  textAlign: 'center',
}

const stylePlatformUsername = {
  color: globalColors.blue,
}

const stylePlatformSubtitle = {
  color: globalColors.black_10,
  marginBottom: globalMargins.medium,
}

const styleProofText = {
  ...globalStyles.fontTerminal,
  marginTop: globalMargins.small,
  padding: 10,
  width: '100%',
  minHeight: 116,
  maxHeight: 116,
  justifyContent: 'stretch',
  alignItems: 'flex-start',
  backgroundColor: globalColors.lightGrey,
  border: `solid 1px ${globalColors.black_10}`,
  borderRadius: 3,
  fontSize: 14,
  lineHeight: '21px',
  whiteSpace: 'pre-wrap',
  wordWrap: 'break-word',
  overflowY: 'auto',
  overflowX: 'hidden',
  textAlign: 'left',
  resize: 'none',
  color: globalColors.black_75,
}

const styleNoteText = {
  marginTop: globalMargins.tiny,
}

const styleProofAction = {
  marginTop: globalMargins.tiny,
}

const styleProofActionIcon = {
  color: globalColors.blue,
  marginRight: globalMargins.xtiny,
}

const styleButtonsContainer = {
  ...globalStyles.flexBoxRow,
  marginTop: globalMargins.medium,
}

export default Render
