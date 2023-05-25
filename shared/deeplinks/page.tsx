import * as React from 'react'
import type * as Container from '../util/container'

const Error = React.lazy(async () => import('./error'))
type OwnProps = Container.ViewPropsToPageProps<typeof Error>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Error {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
