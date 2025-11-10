import * as React from 'react'

const Known = React.lazy(async () => import('./password-known'))

export default {screen: Known}
