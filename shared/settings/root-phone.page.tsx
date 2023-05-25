import * as React from 'react'
import type * as Container from '../util/container'

const Root = React.lazy(async () => import('./root-phone'))
type OwnProps = Container.ViewPropsToPageProps<typeof Root>

const getOptions = () => ({
  title: 'More',
})

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Root {...p.route.params} />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
