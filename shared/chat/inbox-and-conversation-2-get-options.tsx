import * as React from 'react'
import * as Kb from '@/common-adapters'
import InboxAndConvoHeader from './inbox-and-conversation-header'
import {useSafeAreaFrame} from 'react-native-safe-area-context'

const TabletHeader = React.memo(function TabletHeader() {
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
})

export default Kb.Styles.isTablet
  ? {
      headerBackgroundContainerStyle: {},
      headerLeft: null,
      headerLeftContainerStyle: {maxWidth: 0},
      headerRight: null,
      headerRightContainerStyle: {maxWidth: 0},
      headerStyle: {},
      headerTitle: () => <TabletHeader />,
      headerTitleContainerStyle: {},
    }
  : {
      headerTitle: () => {
        return <InboxAndConvoHeader />
      },
    }
