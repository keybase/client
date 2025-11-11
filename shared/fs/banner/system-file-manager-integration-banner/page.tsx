import * as React from 'react'

const Screen = React.lazy(async () => import('./kext-permission-popup'))
export default {screen: Screen}
