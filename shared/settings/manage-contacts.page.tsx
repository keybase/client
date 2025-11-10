import * as React from 'react'
import * as C from '@/constants'

const Page = {
  getOptions: {
    header: undefined,
    title: 'Contacts',
  },
  screen: C.isMobile ? React.lazy(async () => import('./manage-contacts')) : null,
}
export default Page
