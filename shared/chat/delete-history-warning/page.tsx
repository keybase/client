import * as C from '../../constants'
import * as React from 'react'
import type * as Container from '../../util/container'

const Warning = React.lazy(async () => import('./container'))
type OwnProps = Container.ViewPropsToPageProps<typeof Warning>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <C.ChatProvider id={p.route.params.conversationIDKey}>
      <Warning {...p.route.params} />
    </C.ChatProvider>
  </React.Suspense>
)

export default {getScreen: () => Screen}
