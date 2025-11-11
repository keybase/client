import * as React from 'react'

const Screen = React.lazy(async () => import('./forgot-username'))
export default {screen: Screen}
