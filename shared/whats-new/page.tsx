import * as React from 'react'
import * as C from '@/constants'

const getOptions = C.isMobile ? {title: 'Keybase FM 87.7'} : {}

const WN = React.lazy(async () => import('./container'))
const Screen = () => (
  <React.Suspense>
    <WN />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
