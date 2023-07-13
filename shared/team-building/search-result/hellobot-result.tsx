import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as Constants from '../../constants/team-building'
import * as Chat2Gen from '../../actions/chat2-gen'
import CommonResult, {type ResultProps} from './common-result'

const HellobotResult = React.memo(function HellobotResult(props: ResultProps) {
  const dispatch = Container.useDispatch()
  const cancelTeamBuilding = Constants.useContext(s => s.dispatch.cancelTeamBuilding)
  const onSelfChat = () => {
    cancelTeamBuilding()
    setTimeout(() => {
      dispatch(Chat2Gen.createPreviewConversation({participants: [props.username], reason: 'search'}))
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
