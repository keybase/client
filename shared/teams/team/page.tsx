import * as React from 'react'
import type * as C from '../../constants'

const Team = React.lazy(async () => import('.'))
type OwnProps = C.ViewPropsToPageProps<typeof Team>

const getOptions = () => ({
  headerHideBorder: true,
  headerTitle: '',
})

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Team {...p.route.params} />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
