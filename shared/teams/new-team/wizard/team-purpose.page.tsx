import * as React from 'react'

const Screen = React.lazy(async () => import('./team-purpose'))
export default {screen: Screen}
