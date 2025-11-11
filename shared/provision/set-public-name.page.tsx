import * as React from 'react'

const Screen = React.lazy(async () => import('./set-public-name'))
export default {screen: Screen}
