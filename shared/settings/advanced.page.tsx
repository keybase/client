import * as React from 'react'
import * as C from '@/constants'

const getOptions = C.isMobile ? {title: 'Advanced'} : undefined

const Advanced = React.lazy(async () => import('./advanced'))
const Screen = () => (
  <React.Suspense>
    <Advanced />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
