import * as Common from '../router-v2/common'
import * as Kb from '../common-adapters'
import * as React from 'react'
import Header from './header'
import type * as C from '../constants'

const Split = React.lazy(async () => import('./inbox-and-conversation-2'))
type OwnProps = C.ViewPropsToPagePropsMaybe<typeof Split>

const getOptions = ({route}: OwnProps) => {
  if (Kb.Styles.isTablet) {
    return {
      headerLeft: null,
      headerLeftContainerStyle: {maxWidth: 0},
      headerRight: null,
      headerRightContainerStyle: {maxWidth: 0},
      headerStyle: {},
      headerTitle: () => (
        <Common.TabletWrapper>
          <Header conversationIDKey={route.params?.conversationIDKey} />
        </Common.TabletWrapper>
      ),
      headerTitleContainerStyle: {},
    }
  } else {
    return {headerTitle: () => <Header conversationIDKey={route.params?.conversationIDKey} />}
  }
}

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Split {...p.route.params} />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page