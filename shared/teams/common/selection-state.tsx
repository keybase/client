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

export const TeamSelectionProvider = (props: TeamSelectionProviderProps) => {
  const selectedMembersRef = React.useRef(props.selectedMembers)
  const selectedChannelsRef = React.useRef(props.selectedChannels)
  React.useEffect(() => {
    selectedMembersRef.current = props.selectedMembers
  }, [props.selectedMembers])
  React.useEffect(() => {
    selectedChannelsRef.current = props.selectedChannels
  }, [props.selectedChannels])
  const selectedMembers = new Set(props.selectedMembers ?? [])
  const selectedChannels = new Set(props.selectedChannels ?? [])

  const value: TeamSelectionState = {
    clearSelectedChannels: () => {
      selectedChannelsRef.current = undefined
      props.onSelectedChannelsChange(undefined)
    },
    clearSelectedMembers: () => {
      selectedMembersRef.current = undefined
      props.onSelectedMembersChange(undefined)
    },
    selectedChannels,
    selectedMembers,
    setChannelSelected: (conversationIDKey, selected, clearAll) => {
      const nextSelectedChannels = updateSelection(
        selectedChannelsRef.current,
        conversationIDKey,
        selected,
        clearAll
      )
      selectedChannelsRef.current = nextSelectedChannels
      props.onSelectedChannelsChange(nextSelectedChannels)
    },
    setMemberSelected: (username, selected, clearAll) => {
      const nextSelectedMembers = updateSelection(selectedMembersRef.current, username, selected, clearAll)
      selectedMembersRef.current = nextSelectedMembers
      props.onSelectedMembersChange(nextSelectedMembers)
    },
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
  const selectedMembersRef = React.useRef(props.selectedMembers)
  React.useEffect(() => {
    selectedMembersRef.current = props.selectedMembers
  }, [props.selectedMembers])
  const selectedMembers = new Set(props.selectedMembers ?? [])

  const value: ChannelSelectionState = {
    clearSelectedMembers: () => {
      selectedMembersRef.current = undefined
      props.onSelectedMembersChange(undefined)
    },
    selectedMembers,
    setMemberSelected: (username, selected, clearAll) => {
      const nextSelectedMembers = updateSelection(selectedMembersRef.current, username, selected, clearAll)
      selectedMembersRef.current = nextSelectedMembers
      props.onSelectedMembersChange(nextSelectedMembers)
    },
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
