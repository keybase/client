import * as React from 'react'
import {Box2, Box} from './box'
import Icon from './icon'
import Text from './text'
import Button from './button'
import Emoji from './emoji'
import * as Styles from '../styles'
import * as Container from '../util/container'
import type * as ChatTypes from '../constants/types/chat2'
import * as Constants from '../constants/chat2'
import logger from '../logger'

const Kb = {
  Box,
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
  disabled?: boolean
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
  const messageSend = Constants.useContext(s => s.dispatch.messageSend)
  const messageSendByUsername = Constants.useState(s => s.dispatch.messageSendByUsername)
  const onWave = () => {
    if (props.username) {
      messageSendByUsername(props.username, ':wave:', waitingKey)
    } else if (props.conversationIDKey) {
      messageSend(':wave:', undefined, waitingKey)
    } else {
      logger.warn('WaveButton: need one of username xor conversationIDKey')
      return
    }
    setWaved(true)
  }

  const waveText = props.toMany ? 'Wave at everyone' : 'Wave'

  const hideButton = waved && !waving
  return (
    <Kb.Box style={Styles.collapseStyles([props.style, styles.outer])}>
      {hideButton && (
        <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.waved} gap="xtiny">
          <Kb.Icon type="iconfont-check" color={Styles.globalColors.black_50} sizeType="Tiny" />
          <Kb.Text type="BodySmall"> Waved</Kb.Text>
        </Kb.Box2>
      )}
      <Kb.Button
        onClick={hideButton ? undefined : onWave}
        small={props.small}
        style={hideButton ? styles.hiddenButton : styles.button}
        mode="Secondary"
        waiting={waving}
        disabled={!!props.disabled}
      >
        <Kb.Text type="BodySemibold" style={styles.blueText}>
          {waveText}
        </Kb.Text>
        <Kb.Emoji emojiName=":wave:" size={18} />
      </Kb.Button>
    </Kb.Box>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      blueText: {color: Styles.globalColors.blueDark, paddingRight: Styles.globalMargins.xtiny},
      button: {},
      hiddenButton: {opacity: 0},
      outer: {flexShrink: 0},
      waved: {
        ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small, Styles.globalMargins.xtiny),
        position: 'absolute',
      },
    }) as const
)

export default WaveButton
