import * as Kb from '@/common-adapters'
import * as React from 'react'
import Header from './inbox-and-conversation-header'
import type * as T from '@/constants/types'
import type * as C from '@/constants'
import {Dimensions} from 'react-native'

const Split = React.lazy(async () => import('./inbox-and-conversation-2'))
type OwnProps = C.ViewPropsToPagePropsMaybe<typeof Split>

const getOptions = ({route}: OwnProps) => {
  if (Kb.Styles.isTablet) {
    return {
      headerBackgroundContainerStyle: {},
      headerLeft: null,
      headerLeftContainerStyle: {maxWidth: 0},
      headerRight: null,
      headerRightContainerStyle: {maxWidth: 0},
      headerStyle: {},
      headerTitle: () => {
        const params: undefined | {conversationIDKey?: T.Chat.ConversationIDKey} = route.params
        return (
          <Kb.Box2
            direction="horizontal"
            // ios only allows centered so we do some margin to help spread it out
            style={{
              height: 48,
              marginLeft: -20,
              width: Dimensions.get('window').width,
            }}
          >
            <Header conversationIDKey={params?.conversationIDKey} />
          </Kb.Box2>
        )
      },
      headerTitleContainerStyle: {},
    }
  } else {
    return {
      headerTitle: () => {
        const params: undefined | {conversationIDKey?: T.Chat.ConversationIDKey} = route.params
        return <Header conversationIDKey={params?.conversationIDKey} />
      },
    }
  }
}

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Split {...p.route.params} />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
