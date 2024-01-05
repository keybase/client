import * as React from 'react'
import * as C from '@/constants'

const getOptions = C.isMobile
  ? {
      headerShown: true,
      title: 'Feedback',
    }
  : {}

const Feedback = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof Feedback>
const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Feedback {...p.route.params} />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
