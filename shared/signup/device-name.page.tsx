import * as React from 'react'

const Name = React.lazy(async () => import('./device-name'))

export default {screen: Name}
