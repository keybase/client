import * as React from 'react'
import * as C from '../../constants'
import type * as Container from '../../util/container'

const Picker = React.lazy(async () => import('./container'))
type OwnProps = Container.ViewPropsToPageProps<typeof Picker>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <C.ChatProvider id={p.route.params.conversationIDKey}>
      <Picker {...p.route.params} />
    </C.ChatProvider>
  </React.Suspense>
)

export default {getScreen: () => Screen}
