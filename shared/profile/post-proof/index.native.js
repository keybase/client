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
    onLeftAction,
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
    <Kb.StandardScreen {...notification} onLeftAction={onLeftAction} leftAction="cancel">
      <Kb.PlatformIcon
        style={stylePlatformIcon}
        platform={platform}
        overlay="icon-proof-unfinished"
        overlayColor={Styles.globalColors.grey}
        size={48}
      />
      <Kb.Text
        style={{
          ...stylePlatformUsername,
          ...(stylePlatformSubtitle ? {} : {marginBottom: Styles.globalMargins.tiny}),
        }}
        type="Header"
      >
        {platformUserName}
      </Kb.Text>
      {!!platformSubtitle && (
        <Kb.Text style={stylePlatformSubtitle} type="Body">
          {platformSubtitle}
        </Kb.Text>
      )}
      {descriptionView ||
        (descriptionText && (
          <Kb.Text style={styleDescriptionText} type="Body">
            {descriptionText}
          </Kb.Text>
        ))}
      {!!proofText && (
        <Kb.CopyableText style={styleProofContainer} value={proofText} textStyle={styleProofText} />
      )}
      {!!noteText && (
        <Kb.Text style={styleNoteText} type="BodySmall">
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

const stylePlatformIcon = {
  alignSelf: 'center',
}

const stylePlatformUsername = {
  color: Styles.globalColors.blue,
  textAlign: 'center',
}

const stylePlatformSubtitle = {
  color: Styles.globalColors.black_20,
  marginBottom: Styles.globalMargins.small,
  textAlign: 'center',
}

const styleDescriptionText = {
  marginTop: Styles.globalMargins.tiny,
  textAlign: 'center',
}

const styleProofContainer = {
  marginTop: Styles.globalMargins.tiny,
}

const styleProofText = {
  maxHeight: 7 /* # lines */ * 20 /* line height */ + 2 * 10 /* padding */,
}

const styleNoteText = {
  marginTop: Styles.globalMargins.tiny,
  textAlign: 'center',
}

const styleContinueButton = {
  ...Styles.globalStyles.flexBoxRow,
  marginBottom: Styles.globalMargins.small,
  marginTop: Styles.globalMargins.small,
}

export default PostProof
