import * as C from '@/constants'
import * as React from 'react'
import Normal from '.'
import {OrangeLineContext} from '../orange-line-context'
import {FocusProvider, ScrollProvider} from './context'

// Orange line logic:
// While looking at a thread the line should be static
// If you aren't active (backgrounded on desktop) the orange line will appear above new content
// If you are active and new items get added the orange line will be consistent, either where it was on first
// mount or not there at all (active and new items come)
// Handle mark as unread
const useOrangeLine = () => {
  const conversationIDKey = C.useChatContext(s => s.id)
  const readMsgID = C.useChatContext(s => s.meta.readMsgID)
  const maxMsgID = C.useChatContext(s => s.meta.maxMsgID)
  const metaOrangeShow = maxMsgID > readMsgID
  const active = C.useActiveState(s => s.active)
  const initOrangeLine = metaOrangeShow ? readMsgID : 0
  const [orangeLine, setOrangeLine] = React.useState(initOrangeLine)
  const [lastCID, setLastCID] = React.useState(conversationIDKey)
  const [lastReadMsgID, setLastReadMsgID] = React.useState(readMsgID)
  const [metaGood, setMetaGood] = React.useState(readMsgID > 0)

  // meta not ready yet
  if (readMsgID < 0) {
    return 0
  }

  if (!metaGood) {
    setMetaGood(true)
    setLastReadMsgID(readMsgID)
    setOrangeLine(metaOrangeShow ? readMsgID : 0)
  }

  // convo changed? reset
  if (lastCID !== conversationIDKey) {
    setLastCID(conversationIDKey)
    setLastReadMsgID(readMsgID)
    setOrangeLine(initOrangeLine)
  }

  // not active and we should show?
  if (metaOrangeShow && !active && orangeLine <= 0) {
    setOrangeLine(readMsgID)
  }

  // mark unread
  if (metaOrangeShow && readMsgID < lastReadMsgID) {
    setLastReadMsgID(readMsgID)
    setOrangeLine(readMsgID)
  }

  return orangeLine
}

const WithOrange = React.memo(function WithOrange(p: {orangeLine: number}) {
  return (
    <OrangeLineContext.Provider value={p.orangeLine}>
      <FocusProvider>
        <ScrollProvider>
          <Normal />
        </ScrollProvider>
      </FocusProvider>
    </OrangeLineContext.Provider>
  )
})

const NormalWrapper = React.memo(function NormalWrapper() {
  const orangeLine = useOrangeLine()
  return <WithOrange orangeLine={orangeLine} />
})
export default NormalWrapper
