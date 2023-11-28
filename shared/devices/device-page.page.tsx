import * as React from 'react'
import type * as C from '@/constants'

const Device = React.lazy(async () => import('./device-page'))
type OwnProps = C.ViewPropsToPageProps<typeof Device>

const getOptions = () => ({
  title: '',
})

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Device {...p.route.params} />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
