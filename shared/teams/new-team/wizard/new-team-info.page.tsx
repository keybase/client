import * as React from 'react'

const Info = React.lazy(async () => import('./new-team-info'))

export default {screen: Info}
