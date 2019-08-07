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

// See '.js.flow' for explanation
const LongPressable = (props: {children: React.ElementType; onSwipeLeft: () => void}) => {
  const {children, ...rest} = props
  const swipeable = React.useRef<Kb.Swipeable>(null)
  const onRightOpen = () => {
    props.onSwipeLeft()
    swipeable.current && swipeable.current.close()
  }
  return (
    // @ts-ignore failOffsetX exists in GestureHandler but not swipable
    <Kb.Swipeable
      ref={swipeable}
      renderRightActions={_renderRightActions}
      onSwipeableRightWillOpen={onRightOpen}
      friction={2}
      rightThreshold={100}
      failOffsetX={0}
    >
      <Kb.NativeTouchableHighlight key="longPressbale" {...rest}>
        <Kb.NativeView style={styles.view}>{children}</Kb.NativeView>
      </Kb.NativeTouchableHighlight>
    </Kb.Swipeable>
  )
}

const styles = Styles.styleSheetCreate({
  replyIcon: {
    paddingRight: Styles.globalMargins.small,
  },
  view: {
    ...Styles.globalStyles.flexBoxColumn,
    position: 'relative',
  },
})

export default LongPressable
