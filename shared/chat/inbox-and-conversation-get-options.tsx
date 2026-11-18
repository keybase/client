import * as React from 'react'
import * as Kb from '@/common-adapters'
import InboxAndConvoHeader from '@/chat/inbox-and-conversation-header'
import {useSafeAreaFrame, useSafeAreaInsets} from 'react-native-safe-area-context'

type Measurable = {measureInWindow: (cb: (x: number) => void) => void}

// iOS only centers a custom title view, so it is made the window's width and moved to start at the
// window's left edge: by a fixed -20 on iPad, and on an iPhone by however far iOS placed it from there
// (measured; on an iPhone Duo it lands at -32).
function TabletHeader() {
  const {width} = useSafeAreaFrame()
  // an iPhone Duo's status column takes the window's right edge
  const {right} = useSafeAreaInsets()
  const ref = React.useRef<Measurable>(null)
  const [phoneShift, setPhoneShift] = React.useState(0)
  const onLayout = Kb.Styles.isTablet
    ? undefined
    : () => {
        ref.current?.measureInWindow(x => {
          if (x) setPhoneShift(shift => shift - x)
        })
      }
  return (
    <Kb.Box2
      ref={ref as never}
      onLayout={onLayout}
      alignSelf="center"
      direction="horizontal"
      style={{height: 48, marginLeft: Kb.Styles.isTablet ? -20 : phoneShift, paddingRight: right, width}}
    >
      <InboxAndConvoHeader />
    </Kb.Box2>
  )
}

// Mobile split view (iPad, a wide iPhone)
export const mobileSplitOptions = {
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

export default Kb.Styles.isTablet
  ? mobileSplitOptions
  : {
      headerTitle: () => <InboxAndConvoHeader />,
    }
