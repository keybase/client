import * as React from 'react'
import * as Kb from '../../../../../common-adapters/mobile.native'
import * as Styles from '../../../../../styles'

const _renderLeftActions = () => {
  return (
    <Kb.Box2 direction="horizontal">
      <Kb.Icon type="iconfont-reply" style={styles.replyIcon} />
    </Kb.Box2>
  )
}

// See '.js.flow' for explanation
const LongPressable = (props: {children: React.ElementType; onSwipeRight: () => void}) => {
  const {children, ...rest} = props
  const swipeable = React.useRef<Kb.Swipeable>()
  const onLeftOpen = () => {
    props.onSwipeRight()
    swipeable.current && swipeable.current.close()
  }
  return (
    <Kb.Swipeable ref={swipeable} renderLeftActions={_renderLeftActions} onSwipeableLeftWillOpen={onLeftOpen}>
      <Kb.NativeTouchableHighlight key="longPressbale" {...rest}>
        <Kb.NativeView style={styles.view}>{children}</Kb.NativeView>
      </Kb.NativeTouchableHighlight>
    </Kb.Swipeable>
  )
}

const styles = Styles.styleSheetCreate({
  replyIcon: {
    padding: Styles.globalMargins.xtiny,
  },
  view: {
    ...Styles.globalStyles.flexBoxColumn,
    position: 'relative',
  },
})

export default LongPressable
