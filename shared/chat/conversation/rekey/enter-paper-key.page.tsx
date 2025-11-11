import * as React from 'react'

const Screen = React.lazy(async () => import('./enter-paper-key'))
export default {screen: Screen}
