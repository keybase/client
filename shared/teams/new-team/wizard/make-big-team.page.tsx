import * as React from 'react'

const Big = React.lazy(async () => import('./make-big-team'))

export default {screen: Big}
