import * as React from 'react'

const Password = React.lazy(async () => import('./password'))

export default {getOptions: {gesturesEnabled: false}, screen: Password}
