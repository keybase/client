import * as React from 'react'
import type * as Container from '../../util/container'

const UOE = React.lazy(async () => import('./container'))
type OwnProps = Container.ViewPropsToPageProps<typeof UOE>

const getOptions = () => ({
  headerBottomStyle: {height: undefined},
  headerLeft: null, // no back button
})

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <UOE {...p.route.params} />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
