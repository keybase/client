import * as React from 'react'

const Screen = React.lazy(async () => import('./create-subteams'))
export default {screen: Screen}
