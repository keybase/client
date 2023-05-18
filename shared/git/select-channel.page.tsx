import * as React from 'react'
import type * as Container from '../util/container'

const Select = React.lazy(async () => import('./select-channel'))
type OwnProps = Container.ViewPropsToPageProps<typeof Select>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Select {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
