import * as React from 'react'
import {Box2} from './box'
import Icon from './icon'
import Text from './text'
import Button from './button'
import Emoji from './emoji'
import * as Styles from '../styles'
import * as Container from '../util/container'
import HiddenString from '../util/hidden-string'
import * as Chat2Gen from '../actions/chat2-gen'
import * as ChatTypes from '../constants/types/chat2'
import logger from '../logger'

const Kb = {
  Box2,
  Button,
  Emoji,
  Icon,
  Text,
}

type Props = {
  small?: boolean
  style?: Styles.StylesCrossPlatform
  toMany?: boolean
} & (
  | {conversationIDKey: ChatTypes.ConversationIDKey; username?: never}
  | {conversationIDKey?: never; username: string}
)

const getWaveWaitingKey = (recipient: string) => {
  return `settings:waveButton:${recipient}`
}

// A button that sends a wave emoji into a chat.
export const WaveButton = (props: Props) => {
  const [waved, setWaved] = React.useState(false)
  const waitingKey = getWaveWaitingKey(props.username || props.conversationIDKey || 'missing')
  const waving = Container.useAnyWaiting(waitingKey)
  const dispatch = Container.useDispatch()

  const onWave = () => {
    if (props.username) {
      dispatch(
        Chat2Gen.createMessageSendByUsernames({
          text: new HiddenString(':wave:'),
          usernames: props.username,
          waitingKey,
        })
      )
    } else if (props.conversationIDKey) {
      dispatch(
        Chat2Gen.createMessageSend({
          conversationIDKey: props.conversationIDKey,
          text: new HiddenString(':wave:'),
          waitingKey,
        })
      )
    } else {
      logger.warn('WaveButton: need one of username xor conversationIDKey')
      return
    }
    setWaved(true)
  }

  const waveText = props.toMany ? 'Wave at everyone' : 'Wave'
  return waved && !waving ? (
    <Kb.Box2
      direction="horizontal"
      centerChildren={true}
      style={Styles.collapseStyles([props.style, styles.waved, getWidthStyle(props)])}
      gap="xtiny"
    >
      <Kb.Icon type="iconfont-check" color={Styles.globalColors.black_50} sizeType="Tiny" />
      <Kb.Text type="BodySmall"> Waved</Kb.Text>
    </Kb.Box2>
  ) : (
    <Kb.Button
      onClick={onWave}
      small={props.small}
      mode="Secondary"
      waiting={waving}
      style={Styles.collapseStyles([props.style, getWidthStyle(props)])}
    >
      <Kb.Text type="BodyBig" style={styles.blueText}>
        {waveText}
      </Kb.Text>
      <Kb.Emoji emojiName=":wave:" size={18} />
    </Kb.Button>
  )
}

const getWidthStyle = (props: Props): Styles.StylesCrossPlatform =>
  props.small
    ? props.toMany
      ? styles.waveSmallMany
      : styles.waveSmallOne
    : props.toMany
    ? styles.waveBigMany
    : styles.waveBigOne

const styles = Styles.styleSheetCreate(
  () =>
    ({
      blueText: {color: Styles.globalColors.blueDark, paddingRight: Styles.globalMargins.xtiny},
      waveBigMany: {minWidth: 192},
      waveBigOne: {minWidth: 109},
      waveSmallMany: {minWidth: 168},
      waveSmallOne: {minWidth: 85},
      waved: {
        ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small, Styles.globalMargins.xtiny),
      },
    } as const)
)

export default WaveButton
