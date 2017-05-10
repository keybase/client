// @flow
import * as shared from './post-proof.shared'
import CopyableText from '../common-adapters/copyable-text.native'
import React from 'react'
import {Button, LinkWithIcon, PlatformIcon, StandardScreen, Text} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles'

import type {Props} from './post-proof'

const PostProof = (props: Props) => {
  const {
    platform, platformUserName, descriptionText, proofAction, onCancel,
    onComplete, isOnCompleteWaiting, errorMessage,
  } = props
  const {
    descriptionView, noteText, onCompleteText, proofText, platformSubtitle, proofActionIcon, proofActionText,
  } = shared.propsForPlatform(props)

  const notification = !errorMessage ? {} : {
    notification: {
      type: 'error',
      message: errorMessage,
    },
  }

  return (
    <StandardScreen {...notification} onCancel={onCancel}>
      <PlatformIcon style={stylePlatformIcon} platform={platform} overlay='icon-proof-unfinished' overlayColor={globalColors.grey} size={48} />
      <Text style={{...stylePlatformUsername, ...(stylePlatformSubtitle ? {} : {marginBottom: globalMargins.tiny})}} type='Header'>{platformUserName}</Text>
      {!!platformSubtitle && <Text style={stylePlatformSubtitle} type='Body'>{platformSubtitle}</Text>}
      {descriptionView || (descriptionText && <Text style={styleDescriptionText} type='Body'>{descriptionText}</Text>)}
      {!!proofText && <CopyableText style={styleProofContainer} value={proofText} textStyle={styleProofText} />}
      {!!noteText && <Text style={styleNoteText} type='BodySmall'>{noteText}</Text>}
      {!!proofAction && !!proofActionText && !!proofActionIcon && <LinkWithIcon style={styleProofAction} label={proofActionText} icon={proofActionIcon} color={globalColors.blue} onClick={() => proofAction()} />}
      <Button style={styleContinueButton} fullWidth={true} type='Primary' onClick={() => onComplete()} label={onCompleteText} waiting={isOnCompleteWaiting} />
    </StandardScreen>
  )
}

const stylePlatformIcon = {
  alignSelf: 'center',
}

const stylePlatformUsername = {
  color: globalColors.blue,
  textAlign: 'center',
}

const stylePlatformSubtitle = {
  color: globalColors.black_20,
  marginBottom: globalMargins.small,
  textAlign: 'center',
}

const styleDescriptionText = {
  textAlign: 'center',
  marginTop: globalMargins.tiny,
}

const styleProofContainer = {
  marginTop: globalMargins.tiny,
}

const styleProofText = {
  maxHeight: 7 /* # lines */ * 20 /* line height */ + 2 * 10 /* padding */,
}

const styleNoteText = {
  marginTop: globalMargins.tiny,
  textAlign: 'center',
}

const styleProofAction = {
  marginTop: globalMargins.tiny,
}

const styleContinueButton = {
  ...globalStyles.flexBoxRow,
  marginTop: globalMargins.small,
  marginBottom: globalMargins.small,
}

export default PostProof
