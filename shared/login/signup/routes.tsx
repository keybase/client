import * as React from 'react'
import {defineRouteMap} from '@/constants/types/router'

export const newRoutes = defineRouteMap({
  signupError: {getOptions: {headerLeft: undefined, title: 'Error'}, screen: React.lazy(async () => import('./error'))},
})
