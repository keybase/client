import {SwipeTrigger} from '../../../../../common-adapters/swipeable.native'
import * as React from 'react'
import * as Kb from '../../../../../common-adapters/mobile.native'
import * as Styles from '../../../../../styles'

// See './index.d.ts' for explanation
const LongPressable = React.memo(function LongPressable(props: {
  children: React.ReactNode
  onSwipeLeft?: () => void
}) {
  const {onSwipeLeft, children, ...rest} = props

  const inner = (
    <Kb.NativeTouchableHighlight
      key="longPressable"
      underlayColor={Styles.globalColors.transparent}
      {...rest}
    >
      <Kb.NativeView style={styles.view}>{children}</Kb.NativeView>
    </Kb.NativeTouchableHighlight>
  )

  const makeAction = React.useCallback(() => {
    return (
      <Kb.Box2 direction="vertical" style={styles.reply}>
        <Kb.Icon type="iconfont-reply" style={styles.replyIcon} />
      </Kb.Box2>
    )
  }, [])

  // Only swipeable if there is an onSwipeLeft handler.
  if (onSwipeLeft) {
    return (
      <SwipeTrigger actionWidth={100} onSwiped={onSwipeLeft} makeAction={makeAction}>
        {inner}
      </SwipeTrigger>
    )
  } else {
    return inner
  }
})

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
