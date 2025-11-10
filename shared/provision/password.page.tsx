import * as React from 'react'

const PWD = React.lazy(async () => import('./password'))

export default {screen: PWD}
