import * as React from 'react'
import * as C from '@/constants'

export default {
  getOptions: C.isMobile ? {title: 'Backup'} : undefined,
  screen: C.featureFlags.archive ? React.lazy(async () => import('.')) : null,
}
