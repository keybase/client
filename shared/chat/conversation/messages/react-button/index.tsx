import * as React from 'react'
import * as Kb from '@/common-adapters'

export type Props = {
  active: boolean
  className?: string
  count: number
  decorated: string
  emoji: string
  onClick: () => void
  onLongPress?: () => void
  style?: Kb.Styles.StylesCrossPlatform
}

const markdownOverride = Kb.Styles.isMobile
  ? {
      customEmoji: {height: 24, width: 24},
      emoji: {height: 21, lineHeight: 24},
      emojiSize: {size: 22},
      paragraph: {},
    }
  : {
      customEmoji: {height: 18, width: 18},
      emoji: {height: 18},
      emojiSize: {size: 18},
      paragraph: {alignSelf: 'center', display: 'flex'},
    }

const ReactButton = React.memo(function ReactButton(p: Props) {
  const {decorated, emoji, onLongPress, active, className, onClick} = p
  const {style, count} = p
  const text = decorated.length ? decorated : emoji
  return (
    <Kb.ClickableBox2
      className={Kb.Styles.classNames('react-button', className, {noShadow: active})}
      onLongPress={onLongPress}
      onClick={onClick}
      style={Kb.Styles.collapseStyles([styles.borderBase, styles.buttonBox, active && styles.active, style])}
    >
      <Kb.Box2 centerChildren={true} fullHeight={true} direction="horizontal" gap="xtiny">
        <Kb.Box2 centerChildren={true} fullHeight={true} direction="horizontal">
          <Kb.Markdown
            serviceOnlyNoWrap={true}
            styleOverride={markdownOverride as any}
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
  )
})

export type NewReactionButtonProps = {
  onOpenEmojiPicker: () => void
  style?: Kb.Styles.StylesCrossPlatform
}

export const NewReactionButton = (p: NewReactionButtonProps) => {
  const {onOpenEmojiPicker, style} = p
  return (
    <Kb.ClickableBox2
      onClick={onOpenEmojiPicker}
      style={Kb.Styles.collapseStyles([
        styles.borderBase,
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

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      active: {
        backgroundColor: Kb.Styles.globalColors.blueLighter2,
        borderColor: Kb.Styles.globalColors.blue,
      },
      borderBase: {
        borderColor: Kb.Styles.globalColors.black_10,
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
      containerInner: {
        alignItems: 'center',
        height: 24,
      },
      count: {
        color: Kb.Styles.globalColors.black_50,
        position: 'relative',
      },
      countActive: {color: Kb.Styles.globalColors.blueDark},
      emoji: {height: 25},
      emojiContainer: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.desktopStyles.boxShadow,
          borderRadius: 4,
          marginRight: Kb.Styles.globalMargins.small,
        },
      }),
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

export default ReactButton
