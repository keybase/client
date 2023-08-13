import * as C from '../../constants'
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Constants from '../../constants/team-building'
import CommonResult, {type ResultProps} from './common-result'

const YouResult = React.memo(function YouResult(props: ResultProps) {
  const cancelTeamBuilding = Constants.useContext(s => s.dispatch.cancelTeamBuilding)
  const previewConversation = C.useChatState(s => s.dispatch.previewConversation)
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
        <Kb.Text type="BodySmall">
          {props.isPreExistingTeamMember ? 'Already in team' : 'Add yourself to the team'}
        </Kb.Text>
      )
      break
    case 'chat2':
      bottomRow = <Kb.Text type="BodySmall">Write secure notes to yourself</Kb.Text>
      onAddOverride.onAdd = onSelfChat
      break
  }

  return <CommonResult {...props} {...onAddOverride} rowStyle={styles.rowContainer} bottomRow={bottomRow} />
})

const styles = Styles.styleSheetCreate(() => ({
  actionButton: Styles.platformStyles({
    common: {
      marginLeft: Styles.globalMargins.tiny,
    },
    isElectron: {
      height: Styles.globalMargins.small,
      width: Styles.globalMargins.small,
    },
    isMobile: {
      height: Styles.globalMargins.large,
      marginRight: Styles.globalMargins.tiny,
      width: Styles.globalMargins.large,
    },
  }),
  rowContainer: {
    ...Styles.padding(
      Styles.globalMargins.tiny,
      Styles.globalMargins.medium,
      Styles.globalMargins.tiny,
      Styles.globalMargins.xsmall
    ),
  },
}))

export default YouResult
