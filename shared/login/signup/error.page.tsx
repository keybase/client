import * as React from 'react'

const Screen = React.lazy(async () => import('./error'))
export default {getOptions: {headerLeft: undefined}, screen: Screen}
