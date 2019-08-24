import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import * as Styles from '../../../../styles'

type Props = {
  error: RPCChatTypes.UICoinFlipError
}

const CoinFlipError = (props: Props) => {
  if (props.error.typ === RPCChatTypes.UICoinFlipErrorTyp.generic && props.error.generic) {
    return <CoinFlipGenericError error={props.error.generic} />
  } else if (props.error.typ === RPCChatTypes.UICoinFlipErrorTyp.absentee && props.error.absentee) {
    return <CoinFlipAbsenteeError error={props.error.absentee} />
  } else if (props.error.typ === RPCChatTypes.UICoinFlipErrorTyp.timeout) {
    return <CoinFlipTimeoutError />
  } else if (props.error.typ === RPCChatTypes.UICoinFlipErrorTyp.aborted) {
    return <CoinFlipAbortedError />
  } else if (props.error.typ === RPCChatTypes.UICoinFlipErrorTyp.dupreg && props.error.dupreg) {
    return <CoinFlipDupError offender={props.error.dupreg} desc="registration" />
  } else if (
    props.error.typ === RPCChatTypes.UICoinFlipErrorTyp.dupcommitcomplete &&
    props.error.dupcommitcomplete
  ) {
    return <CoinFlipDupError offender={props.error.dupcommitcomplete} desc="commitment list" />
  } else if (props.error.typ === RPCChatTypes.UICoinFlipErrorTyp.dupreveal && props.error.dupreveal) {
    return <CoinFlipDupError offender={props.error.dupreveal} desc="secret reveal" />
  } else if (
    props.error.typ === RPCChatTypes.UICoinFlipErrorTyp.commitmismatch &&
    props.error.commitmismatch
  ) {
    return <CoinFlipCommitMismatchError offender={props.error.commitmismatch} />
  }

  return <CoinFlipGenericError error={'Unknown error occurred'} />
}

type GenericProps = {
  error: string
}

const CoinFlipGenericError = (props: GenericProps) => (
  <Kb.Text selectable={true} style={styles.error} type="BodySmall">
    {props.error}
  </Kb.Text>
)

type AbsenteeProps = {
  error: RPCChatTypes.UICoinFlipAbsenteeError
}

const CoinFlipAbsenteeError = (props: AbsenteeProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" style={styles.bordered}>
    <Kb.Text selectable={true} type="Body">
      Uh oh, a participant disappeared:
    </Kb.Text>
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Text selectable={true} style={styles.error} type="BodySemibold">
        {(props.error.absentees || []).map(a => `${a.user} (device: ${a.device})`).join(', ')}
      </Kb.Text>
    </Kb.Box2>
    <Kb.Box2 direction="vertical" fullWidth={true} gap="xtiny">
      <Kb.Text selectable={true} type="Body">
        It was likely a network problem, but they could be trying to pull a fast one.
      </Kb.Text>
      <Kb.Text type="BodyPrimaryLink" onClickURL="https://keybase.io/coin-flip">
        Learn More
      </Kb.Text>
    </Kb.Box2>
  </Kb.Box2>
)

const CoinFlipTimeoutError = () => (
  <Kb.Text selectable={true} style={styles.error} type="BodySmall">
    Flip timed out before a result was obtained.
  </Kb.Text>
)

const CoinFlipAbortedError = () => (
  <Kb.Text selectable={true} style={styles.error} type="BodySmall">
    Flip aborted before a result was obtained.
  </Kb.Text>
)

type DupProps = {
  desc: string
  offender: RPCChatTypes.UICoinFlipErrorParticipant
}

const CoinFlipDupError = (props: DupProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" style={styles.bordered}>
    <Kb.Text selectable={true} type="Body">
      Duplicate {props.desc} received from the following participant:
    </Kb.Text>
    <Kb.Text selectable={true} style={styles.error} type="BodySemibold">
      {props.offender.user} (device: {props.offender.device})
    </Kb.Text>
  </Kb.Box2>
)

type CommitMismatchProps = {
  offender: RPCChatTypes.UICoinFlipErrorParticipant
}

const CoinFlipCommitMismatchError = (props: CommitMismatchProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" style={styles.bordered}>
    <Kb.Text selectable={true} type="Body">
      Commitment mismatch from the following participant:
    </Kb.Text>
    <Kb.Text selectable={true} style={styles.error} type="BodySemibold">
      {props.offender.user} (device: {props.offender.device})
    </Kb.Text>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  bordered: {
    borderColor: Styles.globalColors.greyLight,
    borderLeftWidth: 4,
    borderStyle: 'solid',
    paddingLeft: Styles.globalMargins.tiny,
  },
  error: {
    color: Styles.globalColors.redDark,
  },
})

export default CoinFlipError
