import * as React from 'react'

const Screen = React.lazy(async () => import('./paper-key'))
export default {screen: Screen}
