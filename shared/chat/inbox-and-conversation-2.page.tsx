import * as React from 'react'
import type * as Container from '../util/container'
import * as Styles from '../styles'
import * as Common from '../router-v2/common'
import Header from './header'

const Split = React.lazy(async () => import('./inbox-and-conversation-2'))
type OwnProps = Container.ViewPropsToPageProps<typeof Split>

const getOptions = ({route}: OwnProps) => {
  if (Styles.isTablet) {
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

export default {getOptions, getScreen: () => Screen}