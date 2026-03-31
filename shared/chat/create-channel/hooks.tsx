import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import * as React from 'react'
import * as Teams from '@/stores/teams'
import * as T from '@/constants/types'
import {RPCError} from '@/util/errors'
import upperFirst from 'lodash/upperFirst'
import type {Props} from '.'

export default (p: Props) => {
  const teamID = p.teamID
  const navToChatOnSuccess = p.navToChatOnSuccess ?? true
  const [errorText, setErrorText] = React.useState('')
  const teamname = Teams.useTeamsState(s => Teams.getTeamNameFromID(s, teamID) ?? '')
  const navigateUp = C.Router2.navigateUp
  const onBack = navigateUp
  const [channelname, onChannelnameChange] = React.useState('')
  const [description, onDescriptionChange] = React.useState('')
  const previewConversation = Chat.useChatState(s => s.dispatch.previewConversation)
  const loadTeamChannelList = Teams.useTeamsState(s => s.dispatch.loadTeamChannelList)
  const isMountedRef = React.useRef(false)

  React.useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const onSubmit = () => {
    if (!channelname) {
      return
    }

    if (!teamname) {
      setErrorText('Invalid team name.')
      return
    }

    setErrorText('')
    const f = async () => {
      try {
        const result = await T.RPCChat.localNewConversationLocalRpcPromise(
          {
            identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
            membersType: T.RPCChat.ConversationMembersType.team,
            tlfName: teamname,
            tlfVisibility: T.RPCGen.TLFVisibility.private,
            topicName: channelname,
            topicType: T.RPCChat.TopicType.chat,
          },
          C.waitingKeyTeamsCreateChannel(teamID)
        )
        const conversationIDKey = T.Chat.conversationIDToKey(result.conv.info.id)
        if (!conversationIDKey) {
          throw new Error('Missing conversation ID')
        }
        if (description) {
          await T.RPCChat.localPostHeadlineNonblockRpcPromise(
            {
              clientPrev: 0,
              conversationID: result.conv.info.id,
              headline: description,
              identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
              tlfName: teamname,
              tlfPublic: false,
            },
            C.waitingKeyTeamsCreateChannel(teamID)
          )
        }
        loadTeamChannelList(teamID)
        onBack()
        if (navToChatOnSuccess) {
          previewConversation({channelname, conversationIDKey, reason: 'newChannel', teamname})
        }
      } catch (error) {
        if (isMountedRef.current) {
          setErrorText(upperFirst(error instanceof RPCError ? error.desc : String(error)))
        }
      }
    }
    void f()
  }

  return {
    channelname,
    description,
    errorText,
    onBack,
    onChannelnameChange,
    onDescriptionChange,
    onSubmit,
    teamID,
    teamname,
  }
}
