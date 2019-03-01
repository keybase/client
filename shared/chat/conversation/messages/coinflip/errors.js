// @flow
import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'

type Props = {|
  error: RPCChatTypes.UICoinFlipError,
|}

const CoinFlipError = (props: Props) => {
  if (props.error.typ === RPCChatTypes.chatUiUICoinFlipErrorTyp.generic && props.error.generic) {
    return <CoinFlipGenericError error={props.error.generic} />
  } else if (props.error.typ === RPCChatTypes.chatUiUICoinFlipErrorTyp.absentee && props.error.absentee) {
    return <CoinFlipAbsenteeError error={props.error.absentee} />
  }
  return <CoinFlipGenericError error={'Unknown error occurred'} />
}

type GenericProps = {|
  error: string,
|}

const CoinFlipGenericError = (props: GenericProps) => {
  return (
    <Kb.Text style={styles.error} type="BodyItalic">
      {props.error}
    </Kb.Text>
  )
}

type AbsenteeProps = {|
  error: RPCChatTypes.UICoinFlipAbsenteeError,
|}

const CoinFlipAbsenteeError = (props: AbsenteeProps) => {
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
      <Kb.Text type="Body">
        {props.error.absentees && props.error.absentees.length === 1 ? 'One player' : 'Some players'} that
        committed to the coin flip failed to reveal their secrets in time:
      </Kb.Text>
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Kb.Text type="BodySemibold">
          {(props.error.absentees || []).map(a => `${a.user} (device: ${a.device})`).join(', ')}
        </Kb.Text>
      </Kb.Box2>
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Kb.Text type="BodySemibold">This could mean one of two things:</Kb.Text>
        <Kb.Text type="Body">
          • Either their client disconnected and could not reveal their secret, or
        </Kb.Text>
        <Kb.Text type="Body">
          • They're trying to cheat by disconnecting on purpose in order to force a new flip.
        </Kb.Text>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  error: {
    color: Styles.globalColors.red,
  },
})

export default CoinFlipError
