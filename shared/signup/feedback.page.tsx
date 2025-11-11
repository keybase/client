import * as React from 'react'

const Screen = React.lazy(async () => import('./feedback'))
export default {screen: Screen}
