import * as React from 'react'
import * as C from '../../../constants'
import type * as Container from '../../../util/container'

const Titles = React.lazy(async () => import('./container'))
type OwnProps = Container.ViewPropsToPageProps<typeof Titles>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <C.ChatProvider id={p.route.params.conversationIDKey}>
      <Titles {...p.route.params} />
    </C.ChatProvider>
  </React.Suspense>
)

export default {getScreen: () => Screen}
