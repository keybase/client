import * as React from 'react'
import * as C from '../constants'

const New = React.lazy(async () => import('./new-team-dialog-container'))
type OwnProps = C.ViewPropsToPageProps<typeof New>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <C.ProviderScreen rp={p}>
      <New {...p.route.params} />
    </C.ProviderScreen>
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
