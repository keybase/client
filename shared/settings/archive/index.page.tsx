import * as React from 'react'
import * as C from '@/constants'

const getOptions = C.isMobile ? {title: 'Archive'} : undefined

const Archive = React.lazy(async () => import('.'))

const Screen = C.featureFlags.archive
  ? () => (
      <React.Suspense>
        <Archive />
      </React.Suspense>
    )
  : () => null

const Page = {getOptions, getScreen: () => Screen}
export default Page
