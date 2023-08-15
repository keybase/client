import * as React from 'react'
import * as C from '../constants'
import type * as Container from '../util/container'

const New = React.lazy(async () => import('./new-team-dialog-container'))
type OwnProps = Container.ViewPropsToPageProps<typeof New>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <C.ProviderScreen rp={p}>
      <New {...p.route.params} />
    </C.ProviderScreen>
  </React.Suspense>
)

export default {getScreen: () => Screen}
