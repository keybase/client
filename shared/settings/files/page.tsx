import * as React from 'react'
import * as C from '@/constants'

const getOptions = C.isMobile ? {title: 'Files'} : undefined

const Files = React.lazy(async () => import('./container'))
const Screen = () => (
  <React.Suspense>
    <Files />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
