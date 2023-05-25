import * as React from 'react'
import type * as Container from '../../../../../util/container'

const SetDef = React.lazy(async () => import('./container'))
type OwnProps = Container.ViewPropsToPageProps<typeof SetDef>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <SetDef {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
