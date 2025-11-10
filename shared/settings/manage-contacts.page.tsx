import * as React from 'react'
import * as C from '@/constants'

export default {
  getOptions: {
    header: undefined,
    title: 'Contacts',
  },
  screen: C.isMobile ? React.lazy(async () => import('./manage-contacts')) : null,
}
