import * as React from 'react'
import type * as Container from '../../util/container'
import * as Constants from '../../constants/chat2'

const Warning = React.lazy(async () => import('./container'))
type OwnProps = Container.ViewPropsToPageProps<typeof Warning>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Constants.Provider id={p.route.params.conversationIDKey}>
      <Warning {...p.route.params} />
    </Constants.Provider>
  </React.Suspense>
)

export default {getScreen: () => Screen}
