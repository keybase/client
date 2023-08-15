import * as React from 'react'
import * as C from '../../../constants'
import type * as Container from '../../../util/container'

const Search = React.lazy(async () => import('./search'))
type OwnProps = Container.ViewPropsToPageProps<typeof Search>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <C.ChatProvider id={p.route.params.conversationIDKey ?? C.noConversationIDKey}>
      <Search {...p.route.params} />
    </C.ChatProvider>
  </React.Suspense>
)

export default {getScreen: () => Screen}
