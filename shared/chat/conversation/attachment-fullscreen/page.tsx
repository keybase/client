import * as React from 'react'
import type * as Container from '../../../util/container'

const Full = React.lazy(async () => import('./container'))
type OwnProps = Container.ViewPropsToPageProps<typeof Full>

const getOptions = () => ({
  safeAreaStyle: {
    backgroundColor: 'black', // true black
  },
})

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Full {...p.route.params} />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
