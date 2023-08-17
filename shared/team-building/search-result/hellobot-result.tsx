import * as C from '../../constants'
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import CommonResult, {type ResultProps} from './common-result'

const HellobotResult = React.memo(function HellobotResult(props: ResultProps) {
  const cancelTeamBuilding = C.useTBContext(s => s.dispatch.cancelTeamBuilding)
  const previewConversation = C.useChatState(s => s.dispatch.previewConversation)
  const onSelfChat = () => {
    cancelTeamBuilding()
    setTimeout(() => {
      previewConversation({participants: [props.username], reason: 'search'})
    }, 500)
  }
  const bottomRow: React.ReactNode = <Kb.Text type="BodySmall">Say hi, play puzzles, or ask for help</Kb.Text>

  return <CommonResult {...props} onAdd={onSelfChat} rowStyle={styles.rowContainer} bottomRow={bottomRow} />
})

const styles = Styles.styleSheetCreate(() => ({
  rowContainer: {
    ...Styles.padding(
      Styles.globalMargins.tiny,
      Styles.globalMargins.medium,
      Styles.globalMargins.tiny,
      Styles.globalMargins.xsmall
    ),
  },
}))

export default HellobotResult
