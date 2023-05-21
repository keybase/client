import * as React from 'react'
import type * as Container from '../util/container'

const Device = React.lazy(async () => import('./device-page'))
type OwnProps = Container.ViewPropsToPageProps<typeof Device>

const getOptions = () => ({
  title: '',
})

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Device {...p.route.params} />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
