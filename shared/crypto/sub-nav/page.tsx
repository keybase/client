import * as React from 'react'
import * as C from '@/constants'

const getOptions = C.isMobile ? {title: 'Crypto'} : {title: 'Crypto tools'}

const Crypto = React.lazy(async () => import('.'))
const Screen = () => (
  <React.Suspense>
    <Crypto />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen, skipShim: !C.isMobile}
export default Page
