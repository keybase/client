import * as React from 'react'
import type * as Container from '../../../util/container'
import * as Constants from '../../../constants/chat2'

const Confirm = React.lazy(async () => import('./confirm'))
type OwnProps = Container.ViewPropsToPageProps<typeof Confirm>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Constants.Provider id={p.route.params.conversationIDKey ?? Constants.noConversationIDKey}>
      <Confirm {...p.route.params} />
    </Constants.Provider>
  </React.Suspense>
)

export default {getScreen: () => Screen}
