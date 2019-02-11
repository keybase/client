// @flow
import * as Shared from './shared'
import * as React from 'react'
import * as Constants from '../../constants/profile'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import type {Props} from '.'

const PostProof = (props: Props) => {
  const {
    descriptionView,
    noteText,
    onCompleteText,
    proofText,
    platformSubtitle,
    proofActionText,
  } = Shared.propsForPlatform(props)
  const {proofAction} = props

  return (
    <Kb.Box
      style={styleContainer}
      onCopyCapture={e => {
        // disallow copying the whole screen by accident
        e.preventDefault()
        proofText && props.copyToClipboard(proofText)
      }}
    >
      <Kb.Icon
        style={styleClose}
        type="iconfont-close"
        color={Styles.globalColors.black_10}
        onClick={() => props.onCancel()}
      />
      {!!props.errorMessage && (
        <Kb.Box style={styleErrorBanner}>
          <Kb.Text center={true} style={styleErrorBannerText} type="BodySemibold">
            {props.errorMessage}
          </Kb.Text>
        </Kb.Box>
      )}
      <Kb.Box style={{...Styles.globalStyles.flexBoxRow, flex: 1}}>
        <Kb.Box style={styleContentContainer}>
          <Kb.PlatformIcon
            platform={props.platform}
            overlay="icon-proof-unfinished"
            overlayColor={Styles.globalColors.grey}
          />
          <Kb.Text
            style={{
              ...stylePlatformUsername,
              ...(stylePlatformSubtitle ? {} : {marginBottom: Styles.globalMargins.medium}),
            }}
            type="Header"
          >
            {props.platformUserName}
          </Kb.Text>
          {!!platformSubtitle && (
            <Kb.Text style={stylePlatformSubtitle} type="Body">
              {platformSubtitle}
            </Kb.Text>
          )}
          {descriptionView ||
            (props.descriptionText && <Kb.Text type="Body">{props.descriptionText}</Kb.Text>)}
          {!!proofText && <Kb.CopyableText style={styleProofText} value={proofText} />}
          {!!noteText && (
            <Kb.Text style={styleNoteText} type="Body">
              {noteText}
            </Kb.Text>
          )}
          <Kb.Box style={styleButtonsContainer}>
            {!!props.onCancelText && (
              <Kb.Button
                type="Secondary"
                onClick={() => props.onCancel()}
                label={props.onCancelText || 'Cancel'}
                style={{marginRight: Styles.globalMargins.tiny}}
              />
            )}
            {!!proofAction && !props.allowProofCheck && (
              <Kb.Button
                type="Primary"
                onClick={() => {
                  props.onAllowProofCheck(true)
                  proofAction()
                }}
                label={proofActionText || ''}
              />
            )}
            {props.allowProofCheck && (
              <Kb.WaitingButton
                type="Primary"
                onClick={() => props.onComplete()}
                label={onCompleteText || ''}
                waitingKey={Constants.waitingKey}
              />
            )}
          </Kb.Box>
        </Kb.Box>
      </Kb.Box>
    </Kb.Box>
  )
}

const styleContainer = {
  ...Styles.globalStyles.flexBoxColumn,
  flex: 1,
  paddingBottom: Styles.globalMargins.large,
  paddingTop: Styles.globalMargins.large,
  position: 'relative',
  ...Styles.desktopStyles.scrollable,
}

const styleClose = Styles.collapseStyles([
  {
    position: 'absolute',
    right: Styles.globalMargins.small,
    top: Styles.globalMargins.small,
  },
  Styles.desktopStyles.clickable,
])

const styleErrorBanner = {
  ...Styles.globalStyles.flexBoxColumn,
  alignItems: 'center',
  backgroundColor: Styles.globalColors.red,
  justifyContent: 'center',
  marginTop: -Styles.globalMargins.large,
  minHeight: Styles.globalMargins.large,
  padding: Styles.globalMargins.tiny,
  width: '100%',
  zIndex: 1,
}

const styleErrorBannerText = {color: Styles.globalColors.white}

const styleContentContainer = {
  ...Styles.globalStyles.flexBoxColumn,
  alignItems: 'center',
  flex: 1,
  justifyContent: 'center',
  margin: Styles.globalMargins.large,
  textAlign: 'center',
  width: '100%',
}

const stylePlatformUsername = {
  color: Styles.globalColors.blue,
}

const stylePlatformSubtitle = {
  color: Styles.globalColors.black_20,
  marginBottom: Styles.globalMargins.medium,
}

const styleProofText = {
  flexGrow: 1,
  marginTop: Styles.globalMargins.small,
  minHeight: 116,
  width: '100%',
}

const styleNoteText = {
  marginTop: Styles.globalMargins.tiny,
}

const styleButtonsContainer = {
  ...Styles.globalStyles.flexBoxRow,
  flexShrink: 0,
  marginBottom: Styles.globalMargins.medium,
  marginTop: Styles.globalMargins.medium,
}

export default PostProof
