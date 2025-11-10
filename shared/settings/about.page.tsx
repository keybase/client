import * as React from 'react'

export default {getOptions: {title: 'About'}, screen: React.lazy(async () => import('./about'))}
