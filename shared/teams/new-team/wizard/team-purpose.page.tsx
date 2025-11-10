import * as React from 'react'

const Purpose = React.lazy(async () => import('./team-purpose'))

export default {screen: Purpose}
