import * as React from 'react'
import * as Kb from '@/common-adapters'
import type {Props} from '.'

const LongPressable = React.forwardRef<Kb.MeasureRef, Props>(function LongPressable(props, ref) {
  return <Kb.Box2Measure direction="horizontal" fullWidth={true} {...props} ref={ref} />
})
export default LongPressable
