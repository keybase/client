import * as React from 'react'
import * as Kb from '../../../../../common-adapters/mobile.native'
import * as Styles from '../../../../../styles'
import Swipeable from 'react-native-gesture-handler/Swipeable'

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
  const swipeable = React.useRef(null)
  const _onLeftOpen = () => {
    props.onSwipeRight()
    // @ts-ignore the type returned by useRef doesn't seem to work, it always thinks current can be null
    swipeable.current && swipeable.current.close()
  }
  return (
    <Swipeable ref={swipeable} renderLeftActions={_renderLeftActions} onSwipeableLeftOpen={_onLeftOpen}>
      <Kb.NativeTouchableHighlight key="longPressbale" {...rest}>
        <Kb.NativeView key="longPressable" style={styles.view}>
          {children}
        </Kb.NativeView>
      </Kb.NativeTouchableHighlight>
    </Swipeable>
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
