import * as C from '../../../constants'
import * as React from 'react'
import type * as Container from '../../../util/container'

const Confirm = React.lazy(async () => import('./confirm'))
type OwnProps = Container.ViewPropsToPageProps<typeof Confirm>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <C.ChatProvider id={p.route.params.conversationIDKey ?? C.noConversationIDKey}>
      <Confirm {...p.route.params} />
    </C.ChatProvider>
  </React.Suspense>
)

export default {getScreen: () => Screen}
