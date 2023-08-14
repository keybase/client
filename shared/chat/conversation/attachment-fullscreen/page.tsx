import * as React from 'react'
import * as C from '../../../constants'
import type * as Container from '../../../util/container'

const Full = React.lazy(async () => import('./container'))
type OwnProps = Container.ViewPropsToPageProps<typeof Full>

const getOptions = () => ({
  safeAreaStyle: {
    backgroundColor: 'black', // true black
  },
})

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <C.ChatProvider id={p.route.params.conversationIDKey}>
      <Full {...p.route.params} />
    </C.ChatProvider>
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
