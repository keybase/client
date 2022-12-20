import * as React from 'react'

const LongPressable = React.forwardRef(function LongPressable(props, ref: React.Ref<HTMLDivElement>) {
  return <div {...props} ref={ref} />
})
export default LongPressable
