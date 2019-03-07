// @flow
import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import * as Styles from '../../../../styles'

type Props = {|
  error: RPCChatTypes.UICoinFlipError,
  onLearnMore: () => void,
|}

const CoinFlipError = (props: Props) => {
  if (props.error.typ === RPCChatTypes.chatUiUICoinFlipErrorTyp.generic && props.error.generic) {
    return <CoinFlipGenericError error={props.error.generic} />
  } else if (props.error.typ === RPCChatTypes.chatUiUICoinFlipErrorTyp.absentee && props.error.absentee) {
    return <CoinFlipAbsenteeError error={props.error.absentee} onLearnMore={props.onLearnMore} />
  } else if (props.error.typ === RPCChatTypes.chatUiUICoinFlipErrorTyp.timeout) {
    return <CoinFlipTimeoutError />
  } else if (props.error.typ === RPCChatTypes.chatUiUICoinFlipErrorTyp.aborted) {
    return <CoinFlipAbortedError />
  } else if (props.error.typ === RPCChatTypes.chatUiUICoinFlipErrorTyp.dupreg && props.error.dupreg) {
    return <CoinFlipDupError offender={props.error.dupreg} desc="registration" />
  } else if (
    props.error.typ === RPCChatTypes.chatUiUICoinFlipErrorTyp.dupcommitcomplete &&
    props.error.dupcommitcomplete
  ) {
    return <CoinFlipDupError offender={props.error.dupcommitcomplete} desc="commitment list" />
  } else if (props.error.typ === RPCChatTypes.chatUiUICoinFlipErrorTyp.dupreveal && props.error.dupreveal) {
    return <CoinFlipDupError offender={props.error.dupreveal} desc="secret reveal" />
  } else if (
    props.error.typ === RPCChatTypes.chatUiUICoinFlipErrorTyp.commitmismatch &&
    props.error.commitmismatch
  ) {
    return <CoinFlipCommitMismatchError offender={props.error.commitmismatch} />
  }

  return <CoinFlipGenericError error={'Unknown error occurred'} />
}

type GenericProps = {|
  error: string,
|}

const CoinFlipGenericError = (props: GenericProps) => (
  <Kb.Text selectable={true} style={styles.error} type="Body">
    {props.error}
  </Kb.Text>
)

type AbsenteeProps = {|
  error: RPCChatTypes.UICoinFlipAbsenteeError,
  onLearnMore: () => void,
|}

const CoinFlipAbsenteeError = (props: AbsenteeProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
    <Kb.Text selectable={true} type="Body">
      Uh oh, a participant disappeared:
    </Kb.Text>
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Text selectable={true} style={styles.error} type="BodySemibold">
        {(props.error.absentees || []).map(a => `${a.user} (device: ${a.device})`).join(', ')}
      </Kb.Text>
    </Kb.Box2>
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Text selectable={true} type="Body">
        It was likely a network problem, but they could be trying to manipulate the result.
      </Kb.Text>
      <Kb.Text type="BodySmallSemiboldPrimaryLink" onClick={props.onLearnMore}>
        Learn more
      </Kb.Text>
    </Kb.Box2>
  </Kb.Box2>
)

const CoinFlipTimeoutError = () => (
  <Kb.Text selectable={true} style={styles.error} type="Body">
    Flip timed out before a result was obtained.
  </Kb.Text>
)

const CoinFlipAbortedError = () => (
  <Kb.Text selectable={true} style={styles.error} type="Body">
    Flip aborted before a result was obtained.
  </Kb.Text>
)

type DupProps = {|
  desc: string,
  offender: RPCChatTypes.UICoinFlipErrorParticipant,
|}

const CoinFlipDupError = (props: DupProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
    <Kb.Text selectable={true} type="Body">
      Duplicate {props.desc} received from the following participant:
    </Kb.Text>
    <Kb.Text selectable={true} style={styles.error} type="BodySemibold">
      {props.offender.user} (device: {props.offender.device})
    </Kb.Text>
  </Kb.Box2>
)

type CommitMismatchProps = {|
  offender: RPCChatTypes.UICoinFlipErrorParticipant,
|}

const CoinFlipCommitMismatchError = (props: CommitMismatchProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
    <Kb.Text selectable={true} type="Body">
      Commitment mismatch from the following participant:
    </Kb.Text>
    <Kb.Text selectable={true} style={styles.error} type="BodySemibold">
      {props.offender.user} (device: {props.offender.device})
    </Kb.Text>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  error: {
    color: Styles.globalColors.red,
  },
})

export default CoinFlipError
