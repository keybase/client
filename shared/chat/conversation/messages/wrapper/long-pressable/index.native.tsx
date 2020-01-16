import * as React from 'react'
import * as Kb from '../../../../../common-adapters/mobile.native'
import * as Styles from '../../../../../styles'

const _renderRightActions = () => {
  return (
    <Kb.Box2 direction="horizontal">
      <Kb.Icon type="iconfont-reply" style={styles.replyIcon} />
    </Kb.Box2>
  )
}

// See './index.d.ts' for explanation
const LongPressable = (props: {children: React.ElementType; onSwipeLeft?: () => void}) => {
  const {children, ...rest} = props
  const swipeable = React.useRef<Kb.Swipeable>(null)
  const onRightOpen = () => {
    props.onSwipeLeft && props.onSwipeLeft()
    swipeable.current && swipeable.current.close()
  }
  const inner = (
    <Kb.NativeTouchableHighlight key="longPressbale" {...rest}>
      <Kb.NativeView style={styles.view}>{children}</Kb.NativeView>
    </Kb.NativeTouchableHighlight>
  )
  // Only swipeable if there is an onSwipeLeft handler.
  if (props.onSwipeLeft) {
    return (
      <Kb.Swipeable
        ref={swipeable}
        renderRightActions={_renderRightActions}
        onSwipeableRightWillOpen={onRightOpen}
        friction={2}
        rightThreshold={100}
        // @ts-ignore failOffsetX exists in GestureHandler but not swipable
        failOffsetX={0}
      >
        {inner}
      </Kb.Swipeable>
    )
  } else {
    return inner
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      replyIcon: {
        paddingRight: Styles.globalMargins.small,
      },
      view: {
        ...Styles.globalStyles.flexBoxColumn,
        position: 'relative',
      },
    } as const)
)

export default LongPressable
