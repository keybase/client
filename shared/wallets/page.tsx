import * as React from 'react'

const Screen = React.lazy(async () => import('.'))
export default {getOptions: {title: 'Wallet'}, screen: Screen}
