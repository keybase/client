import * as React from 'react'
import * as C from '../../../constants'
import type * as Container from '../../../util/container'

const Fwd = React.lazy(async () => import('./team-picker'))
type OwnProps = Container.ViewPropsToPageProps<typeof Fwd>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <C.ChatProvider id={p.route.params.conversationIDKey}>
      <Fwd {...p.route.params} />
    </C.ChatProvider>
  </React.Suspense>
)

export default {getScreen: () => Screen}
