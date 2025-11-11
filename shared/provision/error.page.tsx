import * as React from 'react'

const Screen = React.lazy(async () => import('./error'))
export default {getOptions: {modal2: true}, screen: Screen}
