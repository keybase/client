import * as React from 'react'

export default {getOptions: {title: 'Display'}, screen: React.lazy(async () => import('./display'))}
