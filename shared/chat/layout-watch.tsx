import {Dimensions} from 'react-native'
import {chatSplitsAt, chatSplitsByWidth, isChatSplit} from '@/constants/chat/layout'
import {moveOpenThreadToLayout} from '@/constants/router'

// App init starts it; the returned function stops it. On a phone whose chat splits by window width,
// each switch between the split and narrow layouts moves the open thread to the route that shows it.
export const watchChatLayout = () => {
  if (!chatSplitsByWidth) return () => {}
  let wasSplit = isChatSplit()
  const sub = Dimensions.addEventListener('change', ({window}: {window: {height: number; width: number}}) => {
    const split = chatSplitsAt(window)
    if (split === wasSplit) return
    wasSplit = split
    moveOpenThreadToLayout(split)
  })
  return () => sub.remove()
}
