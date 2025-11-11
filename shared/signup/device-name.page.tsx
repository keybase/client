import * as React from 'react'

const Screen = React.lazy(async () => import('./device-name'))
export default {screen: Screen}
