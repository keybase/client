import * as React from 'react'
import * as Container from '../../util/container'

const Push = React.lazy(async () => import('./push-prompt'))

const Screen = () =>
  Container.isMobile ? (
    <React.Suspense>
      <Push />
    </React.Suspense>
  ) : null

export default {getScreen: () => Screen}
