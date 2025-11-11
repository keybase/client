import * as React from 'react'

const Screen = React.lazy(async () => import('./add-from-where'))
export default {screen: Screen}
