import * as C from '@/constants'
import {useOrdinal} from './ids-context'
import * as Kb from '@/common-adapters'
import type {StyleOverride} from '@/common-adapters/markdown'
import {colors, darkColors} from '@/styles/colors'
import {useColorScheme} from 'react-native'
import {useCurrentUserState} from '@/stores/current-user'
import * as T from '@/constants/types'
import {useConversationThreadID, useConversationThreadMessage} from '../thread-context'

export type OwnProps = {
  className?: string
  emoji: string
  onLongPress?: () => void
  reaction: T.Chat.ReactionDesc
  style?: Kb.Styles.StylesCrossPlatform
  toggleReaction?: (emoji: string) => void
}

function ReactionButton({
  active,
  className,
  count,
  isDarkMode,
  onClick,
  onLongPress,
  style,
  text,
}: {
  active: boolean
  className?: string
  count: number
  isDarkMode: boolean
  onClick: () => void
  onLongPress?: () => void
  style?: Kb.Styles.StylesCrossPlatform
  text: string
}) {
  return (
    <Kb.ClickableBox
      direction="horizontal"
      centerChildren={true}
      fullHeight={true}
      gap="xtiny"
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
    </Kb.ClickableBox>
  )
}

function ReactButtonContainer(p: OwnProps) {
  const {emoji, reaction} = p
  const me = useCurrentUserState(s => s.username)
  const isDarkMode = useColorScheme() === 'dark'
  const onClick = () => {
    p.toggleReaction?.(emoji)
  }
  const active = reaction.users.some(r => r.username === me)
  const count = reaction.users.length
  const text = reaction.decorated || emoji

  return (
    <ReactionButton
      active={active}
      className={p.className}
      count={count}
      isDarkMode={isDarkMode}
      onClick={onClick}
      onLongPress={p.onLongPress}
      style={p.style}
      text={text}
    />
  )
}

type NewReactionButtonProps = {
  style?: Kb.Styles.StylesCrossPlatform
}

export function NewReactionButton(p: NewReactionButtonProps) {
  const ordinal = useOrdinal()
  const isDarkMode = useColorScheme() === 'dark'
  const conversationIDKey = useConversationThreadID()
  const message = useConversationThreadMessage(ordinal)
  const hasMessageID = !!message && !!T.Chat.messageIDToNumber(message.id)
  const onOpenEmojiPicker = () => {
    if (!message || !T.Chat.messageIDToNumber(message.id)) {
      return
    }
    C.Router2.navigateAppend({
      name: 'chatChooseEmoji',
      params: {conversationIDKey, onPickAddToMessageID: message.id, pickKey: 'reaction'},
    })
  }

  return (
    <Kb.ClickableBox
      direction="horizontal"
      centerChildren={true}
      fullHeight={true}
      onClick={hasMessageID ? onOpenEmojiPicker : undefined}
      style={Kb.Styles.collapseStyles([
        styles.borderBase,
        {borderColor: isDarkMode ? darkColors.black_10 : colors.black_10},
        styles.newReactionButtonBox,
        styles.buttonBox,
        !hasMessageID && styles.disabled,
        p.style,
      ])}
    >
      <Kb.Icon
        type="iconfont-reacji"
        color={Kb.Styles.globalColors.black_50}
        fontSize={18}
        style={styles.emojiIconWrapper}
      />
    </Kb.ClickableBox>
  )
}

const markdownOverride: StyleOverride = isMobile
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
      paragraph: isAndroid ? ({height: 28, textAlignVertical: 'center'} as StyleOverride['paragraph']) : {},
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
          height: isMobile ? 30 : 26,
          justifyContent: 'center',
          minWidth: 40,
          ...Kb.Styles.paddingH(6),
        },
        isElectron: {...Kb.Styles.transition('border-color', 'background-color', 'box-shadow')},
      }),
      count: {
        color: Kb.Styles.globalColors.black_50,
        position: 'relative',
      },
      countActive: {color: Kb.Styles.globalColors.blueDark},
      disabled: {opacity: 0.3},
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
