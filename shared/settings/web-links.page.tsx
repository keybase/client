import * as React from 'react'
import type * as C from '@/constants'

type OwnProps = C.ViewPropsToPageProps<typeof Web>

const getOptions = ({route}: OwnProps) => ({
  header: undefined,
  title: route.params.title,
})

const Web = React.lazy(async () => import('./web-links'))
const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Web {...p.route.params} />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
