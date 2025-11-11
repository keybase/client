import * as React from 'react'

const Screen = React.lazy(async () => import('./select-other-device'))
export default {screen: Screen}
