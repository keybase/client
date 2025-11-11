import * as React from 'react'

const Screen = React.lazy(async () => import('./create-channels'))
export default {screen: Screen}
