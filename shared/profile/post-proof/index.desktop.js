// @flow
import * as shared from './shared'
import * as React from 'react'
import {Box, Button, CopyableText, Icon, PlatformIcon, Text} from '../../common-adapters'
import LinkWithIcon from '../link-with-icon'
import {copyToClipboard} from '../../util/clipboard'
import {globalStyles, globalColors, globalMargins, desktopStyles, collapseStyles} from '../../styles'
import type {Props} from '.'

const PostProof = (props: Props) => {
  const {
    allowProofCheck,
    platform,
    platformUserName,
    descriptionText,
    proofAction,
    onAllowProofCheck,
    onCancel,
    onCancelText,
    onComplete,
    isOnCompleteWaiting,
    errorMessage,
  } = props
  const {
    descriptionView,
    noteText,
    onCompleteText,
    proofText,
    platformSubtitle,
    proofActionIcon,
    proofActionText,
  } = shared.propsForPlatform(props)

  return (
    <Box
      style={styleContainer}
      onCopyCapture={e => {
        // disallow copying the whole screen by accident
        e.preventDefault()
        proofText && copyToClipboard(proofText)
      }}
    >
      <Icon
        style={styleClose}
        type="iconfont-close"
        color={globalColors.black_10}
        onClick={() => onCancel()}
      />
      {!!errorMessage && (
        <Box style={styleErrorBanner}>
          <Text style={styleErrorBannerText} type="BodySemibold">
            {errorMessage}
          </Text>
        </Box>
      )}
      <Box style={{...globalStyles.flexBoxRow, flex: 1}}>
        <Box style={styleContentContainer}>
          <PlatformIcon
            platform={platform}
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
            {platformUserName}
          </Text>
          {!!platformSubtitle && (
            <Text style={stylePlatformSubtitle} type="Body">
              {platformSubtitle}
            </Text>
          )}
          {descriptionView || (descriptionText && <Text type="Body">{descriptionText}</Text>)}
          {!!proofText && <CopyableText style={styleProofText} value={proofText} />}
          {!!noteText && (
            <Text style={styleNoteText} type="Body">
              {noteText}
            </Text>
          )}
          {!!proofAction &&
            !!proofActionIcon && (
              <LinkWithIcon
                style={styleProofAction}
                label={proofActionText || ''}
                icon={proofActionIcon}
                color={globalColors.blue}
                onClick={() => {
                  onAllowProofCheck(true)
                  proofAction()
                }}
              />
            )}
          <Box style={styleButtonsContainer}>
            {!!onCancelText && (
              <Button
                type="Secondary"
                onClick={() => onCancel()}
                label={onCancelText || 'Cancel'}
                style={{marginRight: globalMargins.tiny}}
              />
            )}
            <Button
              disabled={!allowProofCheck}
              type="Primary"
              onClick={() => onComplete()}
              label={onCompleteText}
              waiting={isOnCompleteWaiting}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  position: 'relative',
  paddingTop: globalMargins.large,
  paddingBottom: globalMargins.large,
  ...desktopStyles.scrollable,
}

const styleClose = collapseStyles([
  {
    position: 'absolute',
    top: globalMargins.small,
    right: globalMargins.small,
  },
  desktopStyles.clickable,
])

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
  textAlign: 'center',
}

const styleContentContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  margin: globalMargins.large,
  width: '100%',
  textAlign: 'center',
}

const stylePlatformUsername = {
  color: globalColors.blue,
}

const stylePlatformSubtitle = {
  color: globalColors.black_20,
  marginBottom: globalMargins.medium,
}

const styleProofText = {
  width: '100%',
  minHeight: 116,
  flexGrow: 1,
  marginTop: globalMargins.small,
}

const styleNoteText = {
  marginTop: globalMargins.tiny,
}

const styleProofAction = {
  marginTop: globalMargins.small,
  flexShrink: 0,
}

const styleButtonsContainer = {
  ...globalStyles.flexBoxRow,
  flexShrink: 0,
  marginTop: globalMargins.medium,
  marginBottom: globalMargins.medium,
}

export default PostProof
