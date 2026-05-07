import * as C from '@/constants'
import * as React from 'react'
import * as T from '@/constants/types'
import {RPCError} from '@/util/errors'
import upperFirst from 'lodash/upperFirst'
import type {Props} from '.'
import {useChatTeam} from '../conversation/team-hooks'

export default (p: Props) => {
  const teamID = p.teamID
  const navToChatOnSuccess = p.navToChatOnSuccess ?? true
  const [errorText, setErrorText] = React.useState('')
  const {teamname} = useChatTeam(teamID)
  const navigateUp = C.Router2.navigateUp
  const previewConversation = C.Router2.previewConversation
  const onBack = navigateUp
  const [channelname, onChannelnameChange] = React.useState('')
  const [description, onDescriptionChange] = React.useState('')

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
        onBack()
        if (navToChatOnSuccess) {
          previewConversation({channelname, conversationIDKey, reason: 'newChannel', teamname})
        }
      } catch (error) {
        setErrorText(upperFirst(error instanceof RPCError ? error.desc : String(error)))
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
