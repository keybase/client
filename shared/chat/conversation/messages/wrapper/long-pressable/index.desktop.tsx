import type * as React from 'react'
import * as Kb from '@/common-adapters'
import type {Props} from '@/chat/conversation/messages/wrapper/long-pressable/index.shared'
function LongPressable(props: Props & {ref?: React.Ref<Kb.MeasureRef>}) {
  return <Kb.Box2 direction="horizontal" fullWidth={true} {...props} />
}
export default LongPressable
