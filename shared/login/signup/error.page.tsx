import * as React from 'react'

const Error = React.lazy(async () => import('./error'))

export default {getOptions: {headerLeft: undefined}, screen: Error}
