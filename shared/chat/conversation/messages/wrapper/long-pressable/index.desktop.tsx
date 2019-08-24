import * as React from 'react'
const LongPressable = React.forwardRef((props, ref: React.Ref<HTMLDivElement>) => (
  <div {...props} ref={ref} />
))
export default LongPressable
