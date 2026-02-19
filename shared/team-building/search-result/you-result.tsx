import * as Chat from '@/stores/chat2'
import * as React from 'react'
import {useTBContext} from '@/stores/team-building'
import * as Kb from '@/common-adapters'
import CommonResult, {type ResultProps} from './common-result'

const YouResult = React.memo(function YouResult(props: ResultProps) {
  const cancelTeamBuilding = useTBContext(s => s.dispatch.cancelTeamBuilding)
  const previewConversation = Chat.useChatState(s => s.dispatch.previewConversation)
  const onSelfChat = () => {
    cancelTeamBuilding()
    // wait till modal is gone else we can thrash
    setTimeout(() => {
      previewConversation({participants: [props.username], reason: 'search'})
    }, 500)
  }

  let bottomRow: React.ReactNode = null
  const onAddOverride: {onAdd?: () => void} = {}

  switch (props.namespace) {
    case 'teams':
      bottomRow = (
        <Kb.Text3 type="BodySmall">
          {props.isPreExistingTeamMember ? 'Already in team' : 'Add yourself to the team'}
        </Kb.Text3>
      )
      break
    case 'chat2':
      bottomRow = <Kb.Text3 type="BodySmall">Write secure notes to yourself</Kb.Text3>
      onAddOverride.onAdd = onSelfChat
      break
    default:
  }

  return <CommonResult {...props} {...onAddOverride} rowStyle={styles.rowContainer} bottomRow={bottomRow} />
})

const styles = Kb.Styles.styleSheetCreate(() => ({
  rowContainer: {
    ...Kb.Styles.padding(
      Kb.Styles.globalMargins.tiny,
      Kb.Styles.globalMargins.medium,
      Kb.Styles.globalMargins.tiny,
      Kb.Styles.globalMargins.xsmall
    ),
  },
}))

export default YouResult
