import * as React from 'react'

const Screen = React.lazy(async () => import('./about'))
export default {getOptions: {title: 'About'}, screen: Screen}
