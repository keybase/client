import * as React from 'react'
import * as Kb from '../../../../../common-adapters'

const LongPressable = React.forwardRef(function LongPressable(props, ref: React.Ref<any>) {
  return <Kb.Box2 direction="horizontal" fullWidth={true} {...props} ref={ref} />
})
export default LongPressable
