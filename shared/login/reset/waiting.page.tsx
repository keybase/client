import * as React from 'react'
import type * as C from '../../constants'

const Waiting = React.lazy(async () => import('./waiting'))
type OwnProps = C.ViewPropsToPageProps<typeof Waiting>

const getOptions = () => ({
  headerBottomStyle: {height: undefined},
  headerLeft: null, // no back button
})

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Waiting {...p.route.params} />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
