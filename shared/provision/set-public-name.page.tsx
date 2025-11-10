import * as React from 'react'

const Name = React.lazy(async () => import('./set-public-name'))

export default {screen: Name}
