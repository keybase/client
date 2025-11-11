import * as React from 'react'

const Screen = React.lazy(async () => import('./container'))
export default {screen: Screen}
