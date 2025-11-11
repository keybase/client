import * as React from 'react'

const Screen = React.lazy(async () => import('./make-big-team'))
export default {screen: Screen}
