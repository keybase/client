import * as React from 'react'

const Enter = React.lazy(async () => import('./password-enter'))

export default {screen: Enter}
