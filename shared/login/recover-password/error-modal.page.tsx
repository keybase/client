import * as React from 'react'

const Screen = React.lazy(async () => import('./error-modal'))
export default {getOptions: {gesturesEnabled: false}, screen: Screen}
