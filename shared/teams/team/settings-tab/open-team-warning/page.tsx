import * as React from 'react'
import type * as Container from '../../../../util/container'

const OpenTW = React.lazy(async () => import('.'))
type OwnProps = Container.ViewPropsToPageProps<typeof OpenTW>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <OpenTW {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
