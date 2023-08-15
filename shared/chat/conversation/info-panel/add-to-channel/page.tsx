import * as React from 'react'
import * as C from '../../../../constants'
import type * as Container from '../../../../util/container'

const Add = React.lazy(async () => import('./index.new'))
type OwnProps = Container.ViewPropsToPageProps<typeof Add>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <C.ChatProvider id={p.route.params.conversationIDKey}>
      <Add {...p.route.params} />
    </C.ChatProvider>
  </React.Suspense>
)

export default {getScreen: () => Screen}
