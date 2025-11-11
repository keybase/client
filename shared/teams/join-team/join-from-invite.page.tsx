import * as React from 'react'

const Screen = React.lazy(async () => import('./join-from-invite'))
export default {screen: Screen}
