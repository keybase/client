import * as React from 'react'
import type * as T from '@/constants/types'

type TeamSelectionState = {
  clearSelectedChannels: () => void
  clearSelectedMembers: () => void
  selectedChannels: ReadonlySet<T.Chat.ConversationIDKey>
  selectedMembers: ReadonlySet<string>
  setChannelSelected: (
    conversationIDKey: T.Chat.ConversationIDKey,
    selected: boolean,
    clearAll?: boolean
  ) => void
  setMemberSelected: (username: string, selected: boolean, clearAll?: boolean) => void
}

type TeamSelectionProviderProps = {
  children: React.ReactNode
  onSelectedChannelsChange: (selectedChannels?: Array<T.Chat.ConversationIDKey>) => void
  onSelectedMembersChange: (selectedMembers?: Array<string>) => void
  selectedChannels?: ReadonlyArray<T.Chat.ConversationIDKey>
  selectedMembers?: ReadonlyArray<string>
}

type ChannelSelectionState = {
  clearSelectedMembers: () => void
  selectedMembers: ReadonlySet<string>
  setMemberSelected: (username: string, selected: boolean, clearAll?: boolean) => void
}

type ChannelSelectionProviderProps = {
  children: React.ReactNode
  onSelectedMembersChange: (selectedMembers?: Array<string>) => void
  selectedMembers?: ReadonlyArray<string>
}

const TeamSelectionContext = React.createContext<TeamSelectionState | null>(null)
const ChannelSelectionContext = React.createContext<ChannelSelectionState | null>(null)

const updateSelection = <T,>(
  currentItems: ReadonlyArray<T> | undefined,
  item: T,
  selected: boolean,
  clearAll?: boolean
) => {
  if (clearAll) {
    return undefined
  }
  const nextItems = new Set(currentItems ?? [])
  if (selected) {
    nextItems.add(item)
  } else {
    nextItems.delete(item)
  }
  return nextItems.size ? [...nextItems] : undefined
}

// one selectable collection (members or channels): current set + set/clear that
// report the next selection through onChange, reading the latest value via a ref
// so rapid updates don't act on stale props
const useSelectionSlice = <Item,>(
  items: ReadonlyArray<Item> | undefined,
  onChange: (next?: Array<Item>) => void
) => {
  const itemsRef = React.useRef(items)
  React.useEffect(() => {
    itemsRef.current = items
  }, [items])
  const selected: ReadonlySet<Item> = new Set(items ?? [])
  return {
    clear: () => {
      itemsRef.current = undefined
      onChange(undefined)
    },
    selected,
    set: (item: Item, selected: boolean, clearAll?: boolean) => {
      const next = updateSelection(itemsRef.current, item, selected, clearAll)
      itemsRef.current = next
      onChange(next)
    },
  }
}

export const TeamSelectionProvider = (props: TeamSelectionProviderProps) => {
  const members = useSelectionSlice(props.selectedMembers, props.onSelectedMembersChange)
  const channels = useSelectionSlice(props.selectedChannels, props.onSelectedChannelsChange)

  const value: TeamSelectionState = {
    clearSelectedChannels: channels.clear,
    clearSelectedMembers: members.clear,
    selectedChannels: channels.selected,
    selectedMembers: members.selected,
    setChannelSelected: channels.set,
    setMemberSelected: members.set,
  }

  return <TeamSelectionContext.Provider value={value}>{props.children}</TeamSelectionContext.Provider>
}

export const useTeamSelectionState = () => {
  const context = React.useContext(TeamSelectionContext)
  if (!context) {
    throw new Error('TeamSelectionProvider missing')
  }
  return context
}

export const ChannelSelectionProvider = (props: ChannelSelectionProviderProps) => {
  const members = useSelectionSlice(props.selectedMembers, props.onSelectedMembersChange)

  const value: ChannelSelectionState = {
    clearSelectedMembers: members.clear,
    selectedMembers: members.selected,
    setMemberSelected: members.set,
  }

  return <ChannelSelectionContext.Provider value={value}>{props.children}</ChannelSelectionContext.Provider>
}

export const useChannelSelectionState = () => {
  const context = React.useContext(ChannelSelectionContext)
  if (!context) {
    throw new Error('ChannelSelectionProvider missing')
  }
  return context
}
