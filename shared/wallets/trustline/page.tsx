import * as React from 'react'
import type * as Container from '../../util/container'

const Trust = React.lazy(async () => import('./container'))
type OwnProps = Container.ViewPropsToPageProps<typeof Trust>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Trust {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
