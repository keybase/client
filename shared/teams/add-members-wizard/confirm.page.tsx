import * as React from 'react'

const Screen = React.lazy(async () => import('./confirm'))
export default {getOptions: {gesturesEnabled: false}, screen: Screen}
