import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as React from 'react'
import {Box2, Box} from './box'
import Icon from './icon'
import Text from './text'
import Button from './button'
import NativeEmoji from './emoji/native-emoji'
import * as Styles from '@/styles'
import type * as T from '@/constants/types'
import logger from '@/logger'

const Kb = {
  Box,
  Box2,
  Button,
  Icon,
  NativeEmoji,
  Text,
}

type Props = {
  small?: boolean
  style?: Styles.StylesCrossPlatform
  toMany?: boolean
  disabled?: boolean
} & (
  | {conversationIDKey: T.Chat.ConversationIDKey; username?: never}
  | {conversationIDKey?: never; username: string}
)

const getWaveWaitingKey = (recipient: string) => {
  return `settings:waveButton:${recipient}`
}

const WaveButton = (props: Props) => {
  const hasContext = Chat.useHasContext()
  if (props.username) {
    if (hasContext) {
      return <WaveButtonImpl {...props} />
    } else {
      return (
        <Chat.ChatProvider key="wave" id="" canBeNull={true}>
          <WaveButtonImpl {...props} />
        </Chat.ChatProvider>
      )
    }
  }
  if (hasContext) {
    return <WaveButtonImpl {...props} />
  } else {
    logger.warn('WaveButton: need one of username or conversationIDKey')
    return null
  }
}

// A button that sends a wave emoji into a chat.
const WaveButtonImpl = (props: Props) => {
  const [waved, setWaved] = React.useState(false)
  const waitingKey = getWaveWaitingKey(props.username || props.conversationIDKey || 'missing')
  const waving = C.Waiting.useAnyWaiting(waitingKey)
  const sendMessage = Chat.useChatContext(s => s.dispatch.sendMessage)
  const messageSendByUsername = Chat.useChatState(s => s.dispatch.messageSendByUsername)
  const onWave = () => {
    if (props.username) {
      messageSendByUsername(props.username, ':wave:', waitingKey)
    } else if (props.conversationIDKey) {
      sendMessage(':wave:')
    } else {
      logger.warn('WaveButton: need one of username or conversationIDKey')
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
        <Kb.NativeEmoji emojiName=":wave:" size={18} />
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
