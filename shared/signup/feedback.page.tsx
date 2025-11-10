import * as React from 'react'

const Feedback = React.lazy(async () => import('./feedback'))

export default {screen: Feedback}
