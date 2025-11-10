import * as React from 'react'

const Page = {
  getOptions: {
    header: undefined,
    title: 'Screen Protector',
  },
  screen: React.lazy(async () => import('./screenprotector')),
}
export default Page
