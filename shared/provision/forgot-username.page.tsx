import * as React from 'react'

const Forgot = React.lazy(async () => import('./forgot-username'))

export default {screen: Forgot}
