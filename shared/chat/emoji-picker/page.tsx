import * as React from 'react'
import type * as Container from '../../util/container'

const Picker = React.lazy(async () => import('./container'))
type OwnProps = Container.ViewPropsToPageProps<typeof Picker>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Picker {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
