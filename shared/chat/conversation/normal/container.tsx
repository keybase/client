import * as C from '@/constants'
import * as T from '@/constants/types'
import * as React from 'react'
import Normal from '.'
import {OrangeLineContext} from '../orange-line-context'
import {FocusProvider, ScrollProvider} from './context'

const DEBUG = __DEV__

const noOrd = T.Chat.numberToOrdinal(-1)
const caughtUpOrd = T.Chat.numberToOrdinal(0)
// Orange line logic:
// While looking at a thread the line should be static
// If you aren't active (backgrounded on desktop) the orange line will appear above new content
// If you are active and new items get added the orange line will be consistent, either where it was on first
// mount or not there at all (active and new items come)
// Handle mark as unread
const useOrangeLine = () => {
  const orangeLineRef = React.useRef(noOrd)

  const conversationIDKey = C.useChatContext(s => s.id)
  const lastCIDRef = React.useRef(conversationIDKey)
  const convoChanged = lastCIDRef.current !== conversationIDKey
  lastCIDRef.current = conversationIDKey

  const active = C.useActiveState(s => s.active)
  const lastActiveRf = React.useRef(active)
  const activeChanged = lastActiveRf.current !== active
  const wentInactive = !active && activeChanged
  lastActiveRf.current = active

  const noExisting = orangeLineRef.current === noOrd

  const readMsgID = C.useChatContext(s => {
    const {readMsgID} = s.meta
    return readMsgID
  })
  const lastReadMsgIDRef = React.useRef(readMsgID)

  // mark as unread does this
  const readMsgWentBackwards = !convoChanged && readMsgID > 0 && readMsgID < lastReadMsgIDRef.current
  lastReadMsgIDRef.current = readMsgID

  // only search for an orange line if we need it
  const needToGetOrangeLine = convoChanged || noExisting || wentInactive || readMsgWentBackwards

  const storeOrangeLine = C.useChatContext(s => {
    // don't do a search which could be expensive if we don't need it
    if (!needToGetOrangeLine) return noOrd
    const {readMsgID, maxMsgID} = s.meta
    if (readMsgID <= 0) return noOrd
    if (maxMsgID > readMsgID) {
      const mm = s.messageMap
      // find a good ordinal
      const ord = s.messageOrdinals?.findLast(o => {
        const message = mm.get(o)
        return !!(message && message.id <= readMsgID)
      })
      return ord ?? noOrd
    } else {
      return caughtUpOrd
    }
  })
  const maxMsgOrd = C.useChatContext(s => {
    const {maxMsgID} = s.meta
    const mord = T.Chat.messageIDToNumber(maxMsgID)
    const ord = s.messageMap.get(T.Chat.numberToOrdinal(mord))?.ordinal
    return ord ?? noOrd
  })

  DEBUG &&
    console.log('[useOrangeLine debug] ', {
      convoChanged,
      maxMsgOrd,
      noExisting,
      orangeLineRef: orangeLineRef.current,
      readMsgWentBackwards,
      storeOrangeLine,
      wentInactive,
    })

  if (convoChanged || noExisting || readMsgWentBackwards) {
    orangeLineRef.current = storeOrangeLine
  }

  if (wentInactive) {
    // leave it if it already had one
    if (!orangeLineRef.current) {
      orangeLineRef.current = maxMsgOrd
    }
  }

  return orangeLineRef.current
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
