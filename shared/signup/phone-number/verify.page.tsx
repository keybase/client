import * as React from 'react'

const Verify = React.lazy(async () => import('./verify-container'))

export default {screen: Verify}
