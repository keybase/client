import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as TeamBuildingGen from '../../actions/team-building-gen'
import CommonResult, {ResultProps} from './common-result'

const YouResult = React.memo((props: ResultProps) => {
  const dispatch = Container.useDispatch()
  const onSelfChat = () => {
    dispatch(TeamBuildingGen.createCancelTeamBuilding({namespace: 'chat2'}))
    dispatch(Chat2Gen.createPreviewConversation({participants: [props.username], reason: 'search'}))
  }

  let bottomRow: React.ReactNode = null

  if (props.namespace === 'teams') {
    bottomRow = (
      <Kb.Text type="BodySmall">
        {props.isPreExistingTeamMember ? 'Already in team' : 'Add yourself to the team'}
      </Kb.Text>
    )
  } else {
    bottomRow = <Kb.Text type="BodySmall">Write secure notes to yourself</Kb.Text>
  }

  return <CommonResult {...props} onAdd={onSelfChat} rowStyle={styles.rowContainer} bottomRow={bottomRow} />
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
