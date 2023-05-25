import * as React from 'react'
import type * as Container from '../../../util/container'

const Install = React.lazy(async () => import('./install'))
type OwnProps = Container.ViewPropsToPageProps<typeof Install>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Install {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
