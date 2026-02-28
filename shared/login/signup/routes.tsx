import * as React from 'react'

export const newRoutes = {
  signupError: {getOptions: {headerLeft: undefined}, screen: React.lazy(async () => import('./error'))},
}
