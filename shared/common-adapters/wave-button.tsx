import * as C from '@/constants'
import * as React from 'react'
import {Box2} from './box'
import Icon from './icon'
import Text from './text'
import Button from './button'
import NativeEmoji from './emoji/native-emoji'
import * as Styles from '@/styles'
import * as T from '@/constants/types'
import logger from '@/logger'
import {useCurrentUserState} from '@/stores/current-user'
import {sendTextToConversation} from '@/chat/conversation/send-actions'

const Kb = {
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
  // a conversation's own wave, sent by the caller
  | {onWave: () => void; username?: never}
  | {onWave?: never; username: string}
)

const getWaveWaitingKey = (recipient: string) => {
  return `settings:waveButton:${recipient}`
}

// A button that sends a wave emoji into a chat.
const WaveButton = (props: Props) => {
  const {disabled, onWave: sendWave, small, style, toMany, username: recipient} = props
  const styles = useStyles()
  const theme = Styles.useTheme()
  const [waved, setWaved] = React.useState(false)
  const waitingKey = getWaveWaitingKey(recipient || 'missing')
  const waving = C.Waiting.useAnyWaiting(waitingKey)
  const username = useCurrentUserState(s => s.username)
  const createConversation = C.useRPC(T.RPCChat.localNewConversationLocalRpcPromise)
  const onWave = () => {
    if (recipient) {
      if (!username) {
        logger.warn('WaveButton: missing username for direct wave')
        return
      }
      createConversation(
        [
          {
            identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
            membersType: T.RPCChat.ConversationMembersType.impteamnative,
            tlfName: `${username},${recipient}`,
            tlfVisibility: T.RPCGen.TLFVisibility.private,
            topicType: T.RPCChat.TopicType.chat,
          },
          waitingKey,
        ],
        result => {
          const conversationIDKey = T.Chat.conversationIDToKey(result.conv.info.id)
          if (!conversationIDKey) {
            logger.warn("WaveButton: couldn't resolve wave conversation")
            return
          }
          sendTextToConversation(conversationIDKey, `${username},${recipient}`, ':wave:')
        },
        error => {
          logger.warn('Could not send in WaveButton', error.message)
        }
      )
    } else {
      sendWave?.()
    }
    setWaved(true)
  }

  const waveText = toMany ? 'Wave at everyone' : 'Wave'

  const hideButton = waved && !waving
  return (
    <Kb.Box2 direction="vertical" noShrink={true} style={style}>
      {hideButton && (
        <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.waved} gap="xtiny">
          <Kb.Icon type="iconfont-check" color={theme.black_50} sizeType="Tiny" />
          <Kb.Text type="BodySmall"> Waved</Kb.Text>
        </Kb.Box2>
      )}
      <Kb.Button
        onClick={hideButton ? undefined : onWave}
        small={small}
        style={hideButton ? styles.hiddenButton : styles.button}
        mode="Secondary"
        waiting={waving}
        disabled={!!disabled}
      >
        <Kb.Text type="BodySemibold" style={styles.blueText}>
          {waveText}
        </Kb.Text>
        <Kb.NativeEmoji emojiName=":wave:" size={18} />
      </Kb.Button>
    </Kb.Box2>
  )
}

export default WaveButton

const useStyles = Styles.createStyleHook(
  theme =>
    ({
      blueText: {color: theme.blueDark, paddingRight: Styles.globalMargins.xtiny},
      button: Styles.platformStyles({isElectron: {width: 'auto'}}),
      hiddenButton: {opacity: 0},
      waved: {
        ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small, Styles.globalMargins.xtiny),
        position: 'absolute',
      },
    }) as const
)
