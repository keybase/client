import * as React from 'react'
import type * as Container from '../../../util/container'

const Gen = React.lazy(async () => import('./generate-link'))
type OwnProps = Container.ViewPropsToPageProps<typeof Gen>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Gen {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
