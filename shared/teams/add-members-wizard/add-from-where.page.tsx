import * as React from 'react'

const Channel = React.lazy(async () => import('./add-from-where'))

export default {screen: Channel}
