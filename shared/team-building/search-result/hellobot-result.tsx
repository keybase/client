import type * as React from 'react'
import {previewConversation} from '@/constants/router'
import {useTBContext} from '@/stores/team-building'
import * as Kb from '@/common-adapters'
import CommonResult, {type ResultProps, rowContainerWithLargePadding} from './common-result'

const HellobotResult = function HellobotResult(props: ResultProps) {
  const cancelTeamBuilding = useTBContext(s => s.dispatch.cancelTeamBuilding)
  const onSelfChat = () => {
    cancelTeamBuilding()
    setTimeout(() => {
      previewConversation({participants: [props.username], reason: 'search'})
    }, 500)
  }
  const bottomRow: React.ReactNode = <Kb.Text type="BodySmall">Say hi, play puzzles, or ask for help</Kb.Text>

  return (
    <CommonResult {...props} onAdd={onSelfChat} rowStyle={rowContainerWithLargePadding} bottomRow={bottomRow} />
  )
}

export default HellobotResult
