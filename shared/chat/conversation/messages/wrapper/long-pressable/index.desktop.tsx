import type * as React from 'react'
import * as Kb from '@/common-adapters'
import type {Props} from '.'

function LongPressable(props: Props & {ref?: React.Ref<Kb.MeasureRef>}) {
  return <Kb.Box2Measure direction="horizontal" fullWidth={true} {...props} />
}
export default LongPressable
