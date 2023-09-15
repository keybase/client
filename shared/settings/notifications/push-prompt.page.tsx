import * as React from 'react'
import * as C from '../../constants'

const Push = React.lazy(async () => import('./push-prompt'))

const Screen = () =>
  C.isMobile ? (
    <React.Suspense>
      <Push />
    </React.Suspense>
  ) : null

export default {getScreen: () => Screen}
