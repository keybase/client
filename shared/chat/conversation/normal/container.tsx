import * as C from '@/constants'
import * as T from '@/constants/types'
import * as React from 'react'
import Normal from '.'
import {OrangeLineContext} from '../orange-line-context'
import {FocusProvider, ScrollProvider} from './context'
import logger from '@/logger'

const noOrd = T.Chat.numberToOrdinal(-1)
const caughtUpOrd = T.Chat.numberToOrdinal(0)
// Orange line logic:
// When we enter a conversation and the meta.readMsgID is < meta.maxMsgID we should show the orange line
// When the orange line is showing we should maintain that while in that thread. An orange line can move
// while we're in a thread due to marking as unread. Our cached local orange line (in a ref) can be outdated
// by messages being deleted or ordinals changing. If you're up to date we do not show the orange line as
// new messages come in. If you become inactive we will mark it and any new messages will have an orange line
// on top.
//
const useOrangeLine = () => {
  // our cached orange line location while we're mounted
  const orangeLineRef = React.useRef(noOrd)
  const lastCIDRef = React.useRef<T.Chat.ConversationIDKey>('')
  const lastActiveRef = React.useRef(true)
  const lastReadMsgIDRef = React.useRef(T.Chat.numberToMessageID(-1))
  const active = C.useActiveState(s => s.active)

  C.useChatContext(s => {
    let next = orangeLineRef.current

    // can we keep next?
    // convo changed?
    if (s.id !== lastCIDRef.current) {
      lastCIDRef.current = s.id
      // logger.info('[useOrangeLine debug] clear due to convo change')
      next = noOrd
    }

    // ordinal is gone? search again, ordinals could have resolved
    if (next > 0 && !s.messageMap.has(next)) {
      logger.info('[useOrangeLine debug] clear due to ordinal missing', next)
      next = noOrd
    }

    const activeChanged = lastActiveRef.current !== active
    if (activeChanged) {
      lastActiveRef.current = active
    }

    // lastRead went backwards? due to mark as unread
    if (lastReadMsgIDRef.current >= 0) {
      if (lastReadMsgIDRef.current > s.meta.readMsgID) {
        logger.info('[useOrangeLine debug] mark as unread detected')
        next = noOrd
      }
    }
    lastReadMsgIDRef.current = s.meta.readMsgID

    // possibly search for a new orange line
    if (next === noOrd) {
      // logger.info('[useOrangeLine debug] maybe SEARCHING due to no orange')
      const {readMsgID, maxMsgID} = s.meta
      if (readMsgID > 0) {
        // logger.info('[useOrangeLine debug] good meta')
        if (maxMsgID > readMsgID) {
          logger.info('[useOrangeLine debug] actual SEARCHING')
          const mm = s.messageMap
          // find a good ordinal
          const ord = s.messageOrdinals?.findLast(o => {
            const message = mm.get(o)
            return !!(message && message.id <= readMsgID)
          })
          next = ord ?? noOrd
          logger.info('[useOrangeLine debug] HAS unread ', {maxMsgID, next, readMsgID})
        } else {
          // logger.info('[useOrangeLine debug] caught up', {maxMsgID, readMsgID})
          next = caughtUpOrd
        }
      }
    } else {
      // const {readMsgID, maxMsgID} = s.meta
      // logger.info('[useOrangeLine debug] NOT SEARCHING due to no orange', {maxMsgID, readMsgID})
    }

    // handle active changes only
    if (activeChanged) {
      // we became active and we set the max due to inactive earlier
      if (active && next === s.messageOrdinals?.at(-1)) {
        logger.info('[useOrangeLine debug] became active no orange line, caught up')
        next = caughtUpOrd
      } else if (!active && next === caughtUpOrd) {
        // became inactive while caught up, set max
        next = s.messageOrdinals?.at(-1) ?? noOrd
        logger.info('[useOrangeLine debug] became inactive no orange line, set max', next)
      }
    }

    // logger.info('[useOrangeLine debug] WRITING', orangeLineRef.current, next)
    // we write here so our bookkeeping is disconnected from rendering
    orangeLineRef.current = next
    // we return so we can trigger a re-render
    return next
  })

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
