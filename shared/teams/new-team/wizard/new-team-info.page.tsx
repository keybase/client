import * as React from 'react'

const Screen = React.lazy(async () => import('./new-team-info'))
export default {screen: Screen}
