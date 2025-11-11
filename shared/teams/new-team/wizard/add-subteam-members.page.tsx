import * as React from 'react'

const Screen = React.lazy(async () => import('./add-subteam-members'))
export default {screen: Screen}
