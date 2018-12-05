// @flow
import * as shared from './shared'
import * as React from 'react'
import {Box, Button, CopyableText, Icon, PlatformIcon, Text} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins, desktopStyles, collapseStyles} from '../../styles'
import type {Props} from '.'

const PostProof = (props: Props) => {
  const {
    descriptionView,
    noteText,
    onCompleteText,
    proofText,
    platformSubtitle,
    proofActionText,
  } = shared.propsForPlatform(props)
  const {proofAction} = props

  return (
    <Box
      style={styleContainer}
      onCopyCapture={e => {
        // disallow copying the whole screen by accident
        e.preventDefault()
        proofText && props.copyToClipboard(proofText)
      }}
    >
      <Icon
        style={styleClose}
        type="iconfont-close"
        color={globalColors.black_10}
        onClick={() => props.onCancel()}
      />
      {!!props.errorMessage && (
        <Box style={styleErrorBanner}>
          <Text style={styleErrorBannerText} type="BodySemibold">
            {props.errorMessage}
          </Text>
        </Box>
      )}
      <Box style={{...globalStyles.flexBoxRow, flex: 1}}>
        <Box style={styleContentContainer}>
          <PlatformIcon
            platform={props.platform}
            overlay="icon-proof-unfinished"
            overlayColor={globalColors.grey}
          />
          <Text
            style={{
              ...stylePlatformUsername,
              ...(stylePlatformSubtitle ? {} : {marginBottom: globalMargins.medium}),
            }}
            type="Header"
          >
            {props.platformUserName}
          </Text>
          {!!platformSubtitle && (
            <Text style={stylePlatformSubtitle} type="Body">
              {platformSubtitle}
            </Text>
          )}
          {descriptionView || (props.descriptionText && <Text type="Body">{props.descriptionText}</Text>)}
          {!!proofText && <CopyableText style={styleProofText} value={proofText} />}
          {!!noteText && (
            <Text style={styleNoteText} type="Body">
              {noteText}
            </Text>
          )}
          <Box style={styleButtonsContainer}>
            {!!props.onCancelText && (
              <Button
                type="Secondary"
                onClick={() => props.onCancel()}
                label={props.onCancelText || 'Cancel'}
                style={{marginRight: globalMargins.tiny}}
              />
            )}
            {!!proofAction && !props.allowProofCheck && (
              <Button
                type="Primary"
                onClick={() => {
                  props.onAllowProofCheck(true)
                  proofAction()
                }}
                label={proofActionText || ''}
              />
            )}
            {props.allowProofCheck && (
              <Button
                type="Primary"
                onClick={() => props.onComplete()}
                label={onCompleteText || ''}
                waiting={props.isOnCompleteWaiting}
              />
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  paddingBottom: globalMargins.large,
  paddingTop: globalMargins.large,
  position: 'relative',
  ...desktopStyles.scrollable,
}

const styleClose = collapseStyles([
  {
    position: 'absolute',
    right: globalMargins.small,
    top: globalMargins.small,
  },
  desktopStyles.clickable,
])

const styleErrorBanner = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  backgroundColor: globalColors.red,
  justifyContent: 'center',
  marginTop: -globalMargins.large,
  minHeight: globalMargins.large,
  padding: globalMargins.tiny,
  width: '100%',
  zIndex: 1,
}

const styleErrorBannerText = {
  color: globalColors.white,
  textAlign: 'center',
}

const styleContentContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  flex: 1,
  justifyContent: 'center',
  margin: globalMargins.large,
  textAlign: 'center',
  width: '100%',
}

const stylePlatformUsername = {
  color: globalColors.blue,
}

const stylePlatformSubtitle = {
  color: globalColors.black_20,
  marginBottom: globalMargins.medium,
}

const styleProofText = {
  flexGrow: 1,
  marginTop: globalMargins.small,
  minHeight: 116,
  width: '100%',
}

const styleNoteText = {
  marginTop: globalMargins.tiny,
}

const styleButtonsContainer = {
  ...globalStyles.flexBoxRow,
  flexShrink: 0,
  marginBottom: globalMargins.medium,
  marginTop: globalMargins.medium,
}

export default PostProof
