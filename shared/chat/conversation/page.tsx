import * as React from 'react'
import * as Constants from '../../constants/chat2'
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
    <Constants.Provider id={p.route.params.conversationIDKey ?? Constants.noConversationIDKey}>
      <Convo {...p.route.params} />
    </Constants.Provider>
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
