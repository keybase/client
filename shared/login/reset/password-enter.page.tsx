import * as React from 'react'

const Screen = React.lazy(async () => import('./password-enter'))
export default {screen: Screen}
