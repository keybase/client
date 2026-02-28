import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'

type Props = {
  error: T.RPCChat.UICoinFlipError
}

const CoinFlipError = (props: Props) => {
  switch (props.error.typ) {
    case T.RPCChat.UICoinFlipErrorTyp.generic:
      return <CoinFlipGenericError />
    case T.RPCChat.UICoinFlipErrorTyp.absentee:
      return <CoinFlipAbsenteeError error={props.error.absentee} />
    case T.RPCChat.UICoinFlipErrorTyp.timeout:
      return <CoinFlipTimeoutError />
    case T.RPCChat.UICoinFlipErrorTyp.aborted:
      return <CoinFlipAbortedError />
    case T.RPCChat.UICoinFlipErrorTyp.dupreg:
      return <CoinFlipDupError offender={props.error.dupreg} desc="registration" />
    case T.RPCChat.UICoinFlipErrorTyp.dupcommitcomplete:
      return <CoinFlipDupError offender={props.error.dupcommitcomplete} desc="commitment list" />
    case T.RPCChat.UICoinFlipErrorTyp.dupreveal:
      return <CoinFlipDupError offender={props.error.dupreveal} desc="secret reveal" />
    case T.RPCChat.UICoinFlipErrorTyp.commitmismatch:
      return <CoinFlipCommitMismatchError offender={props.error.commitmismatch} />
  }
}

const CoinFlipGenericError = () => {
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const sendFeedback = () => {
    navigateAppend('modalFeedback')
  }
  return (
    <Kb.Text selectable={true} style={styles.error} type="BodySmall">
      An unexpected error occurred, unable to determine the result of the flip.{' '}
      <Kb.Text onClick={sendFeedback} style={styles.error} type="BodySmallPrimaryLink" underline={true}>
        Please send feedback.
      </Kb.Text>
    </Kb.Text>
  )
}

type AbsenteeProps = {
  error: T.RPCChat.UICoinFlipAbsenteeError
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
  offender: T.RPCChat.UICoinFlipErrorParticipant
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
  offender: T.RPCChat.UICoinFlipErrorParticipant
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

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      bordered: {
        borderColor: Kb.Styles.globalColors.grey,
        borderLeftWidth: 4,
        borderStyle: 'solid',
        paddingLeft: Kb.Styles.globalMargins.tiny,
      },
      error: {
        color: Kb.Styles.globalColors.redDark,
      },
    }) as const
)

export default CoinFlipError
