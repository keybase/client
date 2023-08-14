import * as C from '../../constants'
import * as React from 'react'
import type * as Container from '../../util/container'
import {headerNavigationOptions} from './header-area/container'

const Convo = React.lazy(async () => import('./container'))
type OwnProps = Container.ViewPropsToPageProps<typeof Convo>

const getOptions = ({route}: OwnProps) => ({
  ...headerNavigationOptions(route),
  presentation: undefined,
})

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <C.ChatProvider id={p.route.params.conversationIDKey ?? C.noConversationIDKey}>
      <Convo {...p.route.params} />
    </C.ChatProvider>
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
