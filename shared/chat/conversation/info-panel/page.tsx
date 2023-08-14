import * as C from '../../../constants'
import * as React from 'react'
import type * as Container from '../../../util/container'

const Panel = React.lazy(async () => import('./container'))
type OwnProps = Container.ViewPropsToPageProps<typeof Panel>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <C.ChatProvider id={p.route.params.conversationIDKey}>
      <Panel {...p.route.params} />
    </C.ChatProvider>
  </React.Suspense>
)

export default {getScreen: () => Screen}
