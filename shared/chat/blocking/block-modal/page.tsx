import * as React from 'react'
import type * as C from '../../../constants'

const Block = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof Block>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Block {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
