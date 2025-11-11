import * as React from 'react'

const Screen = React.lazy(async () => import('./password'))
export default {getOptions: {gesturesEnabled: false}, screen: Screen}
