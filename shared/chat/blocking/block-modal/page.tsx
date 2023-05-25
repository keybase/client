import * as React from 'react'
import type * as Container from '../../../util/container'

const Block = React.lazy(async () => import('./container'))
type OwnProps = Container.ViewPropsToPageProps<typeof Block>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Block {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
