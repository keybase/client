import * as React from 'react'
import type * as C from '@/constants'

const getOptions = {
  headerShadowVisible: false,
  headerTitle: '',
}

type OwnProps = C.ViewPropsToPageProps<typeof Team>
const Team = React.lazy(async () => import('.'))
const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Team {...p.route.params} />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
