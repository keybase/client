import * as Kb from '@/common-adapters'
import InboxAndConvoHeader from '@/chat/inbox-and-conversation-header'
import {useSafeAreaFrame} from 'react-native-safe-area-context'

function TabletHeader() {
  const {width} = useSafeAreaFrame()
  return (
    <Kb.Box2
      direction="horizontal"
      // ios only allows centered so we do some margin to help spread it out
      style={{height: 48, marginLeft: -20, width}}
    >
      <InboxAndConvoHeader />
    </Kb.Box2>
  )
}

export default Kb.Styles.isTablet
  ? {
      headerBackgroundContainerStyle: {},
      // The split-view title owns the full header width and renders the account
      // switcher inside its left pane. Keep the native side slots collapsed so
      // they do not shift the inbox/conversation column boundary.
      headerLeft: undefined,
      headerLeftContainerStyle: {maxWidth: 0},
      headerRight: undefined,
      headerRightContainerStyle: {maxWidth: 0},
      headerStyle: {},
      headerTitle: () => <TabletHeader />,
      headerTitleContainerStyle: {},
    }
  : {
      headerTitle: () => <InboxAndConvoHeader />,
    }
