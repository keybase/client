import * as React from 'react'
import type * as Container from '../../../util/container'

const Search = React.lazy(async () => import('./search'))
type OwnProps = Container.ViewPropsToPageProps<typeof Search>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Search {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
