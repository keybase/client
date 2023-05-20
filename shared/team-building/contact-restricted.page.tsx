import * as React from 'react'
import type * as Container from '../util/container'

const Contact = React.lazy(async () => import('./contact-restricted'))
type OwnProps = Container.ViewPropsToPageProps<typeof Contact>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Contact {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
