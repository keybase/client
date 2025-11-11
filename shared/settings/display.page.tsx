import * as React from 'react'

const Screen = React.lazy(async () => import('./display'))
export default {getOptions: {title: 'Display'}, screen: Screen}
