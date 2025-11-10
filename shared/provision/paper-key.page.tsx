import * as React from 'react'

const Paper = React.lazy(async () => import('./paper-key'))

export default {screen: Paper}
