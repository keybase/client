import * as React from 'react'
import type * as Container from '../../util/container'

const Welcome = React.lazy(async () => import('.'))
type OwnProps = Container.ViewPropsToPageProps<typeof Welcome>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Welcome {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
