import * as React from 'react'

const Screen = React.lazy(async () => import('./add-contacts'))
export default {screen: Screen}
