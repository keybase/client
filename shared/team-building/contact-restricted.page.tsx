import * as React from 'react'
import type * as C from '@/constants'

const Contact = React.lazy(async () => import('./contact-restricted'))
type OwnProps = C.ViewPropsToPageProps<typeof Contact>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Contact {...p.route.params} />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
