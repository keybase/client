import * as React from 'react'
import type * as Container from '../../util/container'

const Send = React.lazy(async () => import('.'))
type OwnProps = Container.ViewPropsToPageProps<typeof Send>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Send {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
