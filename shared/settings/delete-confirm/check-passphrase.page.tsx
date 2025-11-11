import * as React from 'react'

const Screen = React.lazy(async () => import('./check-passphrase'))
export default {screen: Screen}
