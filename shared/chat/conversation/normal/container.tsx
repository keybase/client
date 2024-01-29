import * as C from '@/constants'
import * as T from '@/constants/types'
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
  const lastCIDRef = React.useRef(conversationIDKey)
  const orangeLineRef = React.useRef<undefined | T.Chat.Ordinal>()

  const convoChanged = lastCIDRef.current !== conversationIDKey
  const noExisting = orangeLineRef.current === undefined

  // only search for an orange line if we need it
  const needToGetOrangeLine = convoChanged || noExisting

  // 0 caught up, undefined need data, > 0 orange line
  const storeOrangeLine = C.useChatContext(s => {
    if (!needToGetOrangeLine) return undefined
    const {readMsgID, maxMsgID} = s.meta
    if (readMsgID <= 0) return undefined
    if (maxMsgID > readMsgID) {
      const mm = s.messageMap
      // todo find a way to skip this
      const ord = s.messageOrdinals?.findLast(o => {
        const message = mm.get(o)
        return !!(message && message.id <= readMsgID)
      })
      console.log('aaaa found ord', readMsgID, ord)
      return ord
    } else {
      return T.Chat.numberToOrdinal(0)
    }
  })

  // convo changed so reset our refs
  if (convoChanged) {
    lastCIDRef.current = conversationIDKey
    orangeLineRef.current = storeOrangeLine
  } else if (noExisting) {
    orangeLineRef.current = storeOrangeLine
  }

  const TEMPMM = C.useChatContext(s => s.messageMap)

  //
  //
  // const conversationIDKey = C.useChatContext(s => s.id)
  // // const readMsgID = C.useChatContext(s => s.meta.readMsgID)
  // // const maxMsgID = C.useChatContext(s => s.meta.maxMsgID)
  // const active = true // TODO C.useActiveState(s => s.active)
  // const orangeLineRef = React.useRef(0)
  // const lastCIDRef = React.useRef(0)
  //   // from service
  // const {orangeLine,  = C.useChatContext(s => {
  //       const {readMsgID, maxMsgID } = s.meta
  //       if (readMsgID <= 0) return -1
  //       return maxMsgID > readMsgID ? readMsgID : 0
  // })
  //
  // // const lastReadMsgIDRef = React.useRef(readMsgID)
  // // const metaGoodRef = React.useRef(readMsgID > 0)
  // // const mm = C.useChatContext(s => s.messageMap)
  //
  // // meta not ready yet
  // if (readMsgID < 0) {
  //   console.log('aaa orange bad meta', conversationIDKey)
  //   return 0
  // }
  //
  // // init on first good met
  // if (!metaGoodRef.current) {
  //   metaGoodRef.current = true
  //   lastReadMsgIDRef.current = readMsgID
  //   orangeLineRef.current = reinitValue
  // }
  //
  // // convo changed? reset
  // if (lastCIDRef.current !== conversationIDKey) {
  //   lastCIDRef.current = conversationIDKey
  //   lastReadMsgIDRef.current = readMsgID
  //   orangeLineRef.current = reinitValue
  // }
  //
  // // not active and we should show?
  // if (!active && reinitValue && orangeLineRef.current <= 0) {
  //   orangeLineRef.current = reinitValue
  // }
  //
  // // mark unread
  // if (readMsgID < lastReadMsgIDRef.current) {
  //   lastReadMsgIDRef.current = readMsgID
  //   orangeLineRef.current = readMsgID
  // }

  console.log('aaa orange', {
    // active,
    conversationIDKey,
    // lastCIDRef,
    orangeLineRef,
    // eslint-disable-next-line
    TEMPBelowRef: TEMPMM.get(orangeLineRef.current)?.text?.stringValue(),
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

// const conversationIDKey = C.useChatContext(s => s.id)
// const readMsgID = C.useChatContext(s => s.meta.readMsgID)
// const maxMsgID = C.useChatContext(s => s.meta.maxMsgID)
// const active = C.useActiveState(s => s.active)
// const reinitValue = maxMsgID > readMsgID ? readMsgID : 0
// const orangeLineRef = React.useRef(reinitValue)
// const lastCIDRef = React.useRef(conversationIDKey)
// const lastReadMsgIDRef = React.useRef(readMsgID)
// const metaGoodRef = React.useRef(readMsgID > 0)
//
// // TEMP
// const TEMPMM = C.useChatContext(s => s.messageMap)
// // meta not ready yet
// if (readMsgID < 0) {
//   console.log('aaa orange bad meta', conversationIDKey)
//   return 0
// }
//
// // init on first good meta
// if (!metaGoodRef.current) {
//   metaGoodRef.current = true
//   lastReadMsgIDRef.current = readMsgID
//   orangeLineRef.current = reinitValue
//   }
//
// // init on first good orangeLine
// // if (orangeLineRef.current === undefined) {
// //   orangeLineRef.current = orangeLineOrdinal
// // }
//
// // convo changed? reset
// if (lastCIDRef.current !== conversationIDKey) {
//   lastCIDRef.current = conversationIDKey
//   orangeLineRef.current = orangeLineOrdinal
// }
//
// // not active and we should show?
// if (!active && orangeLineRef.current) {
//   orangeLineRef.current = undefined
// }
//
// // mark unread
// if (orangeLineOrdinal && orangeLineRef.current && orangeLineOrdinal < orangeLineRef.current) {
//   orangeLineRef.current = orangeLineOrdinal
// }
