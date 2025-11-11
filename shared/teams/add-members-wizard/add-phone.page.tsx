import * as React from 'react'

const Screen = React.lazy(async () => import('./add-phone'))
export default {screen: Screen}
