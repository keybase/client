// @flow
import * as Shared from './shared'
import * as Constants from '../../constants/profile'
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
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
    onComplete,
    errorMessage,
  } = props
  const {
    descriptionView,
    noteText,
    onCompleteText,
    proofText,
    platformSubtitle,
    proofActionText,
  } = Shared.propsForPlatform(props)

  const notification = !errorMessage
    ? {}
    : {
        notification: {
          message: errorMessage,
          type: 'error',
        },
      }

  return (
    <Kb.StandardScreen {...notification} onCancel={onCancel}>
      <Kb.PlatformIcon
        style={stylePlatformIcon}
        platform={platform}
        overlay="icon-proof-unfinished"
        overlayColor={Styles.globalColors.grey}
        size={48}
      />
      <Kb.Text
        center={true}
        style={{
          ...stylePlatformUsername,
          ...(stylePlatformSubtitle ? {} : {marginBottom: Styles.globalMargins.tiny}),
        }}
        type="Header"
      >
        {platformUserName}
      </Kb.Text>
      {!!platformSubtitle && (
        <Kb.Text center={true} style={stylePlatformSubtitle} type="Body">
          {platformSubtitle}
        </Kb.Text>
      )}
      {descriptionView ||
        (descriptionText && (
          <Kb.Text center={true} style={styleDescriptionText} type="Body">
            {descriptionText}
          </Kb.Text>
        ))}
      {!!proofText && (
        <Kb.CopyableText style={styleProofContainer} value={proofText} textStyle={styleProofText} />
      )}
      {!!noteText && (
        <Kb.Text center={true} style={styleNoteText} type="BodySmall">
          {noteText}
        </Kb.Text>
      )}
      {!!proofAction && !allowProofCheck && (
        <Kb.Button
          style={styleContinueButton}
          fullWidth={true}
          type="Primary"
          onClick={() => {
            onAllowProofCheck(true)
            proofAction()
          }}
          label={proofActionText || ''}
        />
      )}
      {allowProofCheck && (
        <Kb.WaitingButton
          style={styleContinueButton}
          fullWidth={true}
          type="Primary"
          onClick={() => onComplete()}
          label={onCompleteText || ''}
          waitingKey={Constants.waitingKey}
        />
      )}
    </Kb.StandardScreen>
  )
}

const stylePlatformIcon = {alignSelf: 'center'}

const stylePlatformUsername = {color: Styles.globalColors.blue}

const stylePlatformSubtitle = {
  color: Styles.globalColors.black_20,
  marginBottom: Styles.globalMargins.small,
}

const styleDescriptionText = {marginTop: Styles.globalMargins.tiny}
const styleProofContainer = {marginTop: Styles.globalMargins.tiny}

const styleProofText = {
  maxHeight: 7 /* # lines */ * 20 /* line height */ + 2 * 10 /* padding */,
}

const styleNoteText = {marginTop: Styles.globalMargins.tiny}

const styleContinueButton = {
  ...Styles.globalStyles.flexBoxRow,
  marginBottom: Styles.globalMargins.small,
  marginTop: Styles.globalMargins.small,
}

export default PostProof
