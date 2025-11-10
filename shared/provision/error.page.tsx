import * as React from 'react'

const Error = React.lazy(async () => import('./error'))

export default {getOptions: {modal2: true}, screen: Error}
