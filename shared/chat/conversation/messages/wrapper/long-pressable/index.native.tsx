import {SwipeTrigger} from '../../../../../common-adapters/swipeable.native'
import * as React from 'react'
import * as Kb from '../../../../../common-adapters/mobile.native'
import * as Styles from '../../../../../styles'

const Inner = React.memo(function Inner(p: any) {
  const {children, ...rest} = p
  return (
    <Kb.NativeTouchableHighlight
      key="longPressable"
      underlayColor={Styles.globalColors.transparent}
      {...rest}
    >
      <Kb.NativeView style={styles.view}>{children}</Kb.NativeView>
    </Kb.NativeTouchableHighlight>
  )
})

// See './index.d.ts' for explanation
const LongPressable = (props: {children: React.ElementType; onSwipeLeft?: () => void}) => {
  const {onSwipeLeft, ...rest} = props

  const inner = <Inner {...rest} />
  // Only swipeable if there is an onSwipeLeft handler.
  if (onSwipeLeft) {
    return (
      <SwipeTrigger
        actionWidth={100}
        onSwiped={onSwipeLeft}
        action={
          <Kb.Box2 direction="vertical" style={styles.reply}>
            <Kb.Icon type="iconfont-reply" style={styles.replyIcon} />
          </Kb.Box2>
        }
      >
        {inner}
      </SwipeTrigger>
    )
  } else {
    return inner
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      reply: {
        alignSelf: 'flex-end',
        justifyContent: 'flex-end',
      },
      replyIcon: {paddingRight: Styles.globalMargins.small},
      view: {
        ...Styles.globalStyles.flexBoxColumn,
        position: 'relative',
      },
    } as const)
)

export default LongPressable
