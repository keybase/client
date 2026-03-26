import * as React from 'react'

export const newRoutes = {
  signupError: {getOptions: {headerLeft: undefined, title: 'Error'}, screen: React.lazy(async () => import('./error'))},
}
