import * as React from 'react'

const Confirm = React.lazy(async () => import('./confirm'))

export default {getOptions: {gesturesEnabled: false}, screen: Confirm}
