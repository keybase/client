import * as React from 'react'

const Join = React.lazy(async () => import('./join-from-invite'))

export default {screen: Join}
