import * as React from 'react'

const Screen = React.lazy(async () => import('./verify-container'))
export default {screen: Screen}
