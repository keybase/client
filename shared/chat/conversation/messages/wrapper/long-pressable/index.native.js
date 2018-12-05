// @flow
import * as React from 'react'
import * as Kb from '../../../../../common-adapters/mobile.native'
import * as Styles from '../../../../../styles'

// See '.js.flow' for explanation
const LongPressable = (props: {|children: React.Node|}) => {
  const {children, ...rest} = props
  return (
    <Kb.NativeTouchableHighlight key="longPressbale" {...rest}>
      <Kb.NativeView style={styles.view}>{children}</Kb.NativeView>
    </Kb.NativeTouchableHighlight>
  )
}

const styles = Styles.styleSheetCreate({
  view: {
    ...Styles.globalStyles.flexBoxColumn,
  },
})

export default LongPressable
