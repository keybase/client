import * as React from 'react'
import type * as Container from '../../util/container'

const Details = React.lazy(async () => import('./container'))
type OwnProps = Container.ViewPropsToPageProps<typeof Details>

const getOptions = () => ({
  title: 'Transaction details',
})

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Details {...p.route.params} />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
