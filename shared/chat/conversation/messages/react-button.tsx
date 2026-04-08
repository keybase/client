import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import type {StylesCrossPlatform} from '@/styles'
import {useOrdinal} from './ids-context'
import * as Kb from '@/common-adapters'
import type {StyleOverride} from '@/common-adapters/markdown'
import {colors, darkColors} from '@/styles/colors'
import {useColorScheme} from 'react-native'
import {useCurrentUserState} from '@/stores/current-user'
import type * as T from '@/constants/types'

export type OwnProps = {
  className?: string
  emoji?: string
  onLongPress?: () => void
  reaction?: T.Chat.ReactionDesc
  showBorder?: boolean
  style?: StylesCrossPlatform
  toggleReaction?: (emoji: string) => void
}

function ReactButtonContainer(p: OwnProps) {
  const ordinal = useOrdinal()
  const {onLongPress, style, emoji, className, reaction} = p
  const me = useCurrentUserState(s => s.username)
  const isDarkMode = useColorScheme() === 'dark'
  const {active: subscriptionActive, count: subscriptionCount, decorated: subscriptionDecorated} = Chat.useChatContext(
    C.useShallow(s => {
      if (reaction || !emoji) {
        return {active: false, count: 0, decorated: ''}
      }
      const message = s.messageMap.get(ordinal)
      const reactionDesc = message?.reactions?.get(emoji || '')
      const active = (reactionDesc?.users ?? []).some(r => r.username === me)
      return {
        active,
        count: reactionDesc?.users.length ?? 0,
        decorated: reactionDesc?.decorated ?? '',
      }
    })
  )

  const toggleMessageReaction = Chat.useChatContext(s => s.dispatch.toggleMessageReaction)
  const active = reaction ? reaction.users.some(r => r.username === me) : subscriptionActive
  const count = reaction?.users.length ?? subscriptionCount
  const decorated = reaction?.decorated ?? subscriptionDecorated
  const onClick = () => {
    if (!emoji) return
    if (p.toggleReaction) {
      p.toggleReaction(emoji)
      return
    }
    toggleMessageReaction(ordinal, emoji)
  }
  const navigateAppend = Chat.useChatNavigateAppend()
  const onOpenEmojiPicker = () => {
    navigateAppend(conversationIDKey => ({
      name: 'chatChooseEmoji',
      params: {conversationIDKey, onPickAddToMessageOrdinal: ordinal, pickKey: 'reaction'},
    }))
  }

  const text = decorated.length ? decorated : emoji
  return emoji ? (
    <Kb.ClickableBox2
      className={Kb.Styles.classNames('react-button', className, {noShadow: active})}
      onLongPress={onLongPress}
      onClick={onClick}
      style={Kb.Styles.collapseStyles([
        styles.borderBase,
        {borderColor: isDarkMode ? darkColors.black_10 : colors.black_10},
        styles.buttonBox,
        active && styles.active,
        style,
      ])}
    >
      <Kb.Box2 centerChildren={true} fullHeight={true} direction="horizontal" gap="xtiny">
        <Kb.Box2 centerChildren={true} fullHeight={true} direction="horizontal">
          <Kb.Markdown
            serviceOnlyNoWrap={false /* MUST be false to support non-emojis in reactions for bots */}
            styleOverride={markdownOverride}
            lineClamp={1}
            smallStandaloneEmoji={true}
            disallowAnimation={false}
            virtualText={true}
          >
            {text}
          </Kb.Markdown>
        </Kb.Box2>
        <Kb.Text
          type="BodyTinyBold"
          virtualText={true}
          style={Kb.Styles.collapseStyles([styles.count, active && styles.countActive])}
        >
          {count}
        </Kb.Text>
      </Kb.Box2>
    </Kb.ClickableBox2>
  ) : (
    <Kb.ClickableBox2
      onClick={onOpenEmojiPicker}
      style={Kb.Styles.collapseStyles([
        styles.borderBase,
        {borderColor: isDarkMode ? darkColors.black_10 : colors.black_10},
        styles.newReactionButtonBox,
        styles.buttonBox,
        style,
      ])}
    >
      <Kb.Box2 centerChildren={true} fullHeight={true} direction="horizontal">
        <Kb.Icon
          type="iconfont-reacji"
          color={Kb.Styles.globalColors.black_50}
          fontSize={18}
          style={styles.emojiIconWrapper}
        />
      </Kb.Box2>
    </Kb.ClickableBox2>
  )
}

const markdownOverride: StyleOverride = Kb.Styles.isMobile
  ? {
      customEmoji: {
        height: 20,
        transform: [{translateY: 4}],
        width: 20,
      },
      emoji: {
        fontSize: 15,
      },
      emojiSize: {size: 24},
      paragraph: C.isAndroid ? ({height: 28, textAlignVertical: 'center'} as StyleOverride['paragraph']) : {},
    }
  : {
      customEmoji: {height: 18, width: 18},
      emoji: {height: 18},
      emojiSize: {size: 18},
      paragraph: {alignSelf: 'center', display: 'flex'},
    }

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      active: {
        backgroundColor: Kb.Styles.globalColors.blueLighter2,
        borderColor: Kb.Styles.globalColors.blue,
      },
      borderBase: {
        // dynamicColorIOS seems to fail here in the new arch
        //borderColor: Kb.Styles.globalColors.black_10,
        borderRadius: Kb.Styles.borderRadius,
        borderStyle: 'solid',
      },
      buttonBox: Kb.Styles.platformStyles({
        common: {
          alignItems: 'center',
          backgroundColor: Kb.Styles.globalColors.white,
          borderWidth: 1,
          height: Kb.Styles.isMobile ? 30 : 26,
          justifyContent: 'center',
          minWidth: 40,
          paddingLeft: 6,
          paddingRight: 6,
        },
        isElectron: {...Kb.Styles.transition('border-color', 'background-color', 'box-shadow')},
      }),
      count: {
        color: Kb.Styles.globalColors.black_50,
        position: 'relative',
      },
      countActive: {color: Kb.Styles.globalColors.blueDark},
      emojiIconWrapper: Kb.Styles.platformStyles({
        isElectron: {position: 'absolute'},
        isMobile: {marginTop: 2},
      }),
      newReactionButtonBox: Kb.Styles.platformStyles({
        common: {width: 37},
        isElectron: {
          minHeight: 18,
          overflow: 'hidden',
        },
      }),
    }) as const
)

export default ReactButtonContainer
