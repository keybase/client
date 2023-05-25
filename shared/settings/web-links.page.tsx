import * as React from 'react'
import type * as Container from '../util/container'

const Web = React.lazy(async () => import('./web-links'))
type OwnProps = Container.ViewPropsToPageProps<typeof Web>

const getOptions = ({route}: OwnProps) => ({
  header: undefined,
  title: route.params.title,
})

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Web {...p.route.params} />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
