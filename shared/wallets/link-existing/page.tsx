import * as React from 'react'
import type * as Container from '../../util/container'

const Link = React.lazy(async () => import('./container'))
type OwnProps = Container.ViewPropsToPageProps<typeof Link>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Link {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
