import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as TeamBuildingGen from '../../actions/team-building-gen'
import CommonResult, {type ResultProps} from './common-result'

const YouResult = React.memo(function YouResult(props: ResultProps) {
  const dispatch = Container.useDispatch()
  const onSelfChat = () => {
    dispatch(TeamBuildingGen.createCancelTeamBuilding({namespace: 'chat2'}))
    // wait till modal is gone else we can thrash
    setTimeout(() => {
      dispatch(Chat2Gen.createPreviewConversation({participants: [props.username], reason: 'search'}))
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
