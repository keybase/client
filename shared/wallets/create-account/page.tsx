import * as React from 'react'
import type * as Container from '../../util/container'

const Create = React.lazy(async () => import('./container'))
type OwnProps = Container.ViewPropsToPageProps<typeof Create>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Create {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
