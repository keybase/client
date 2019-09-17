import React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type Props = {
  onShowNewTeamDialog: () => void
}

const CreateTeamHeader = ({onShowNewTeamDialog}: Props) => (
  <Kb.Box style={styles.container}>
    <Kb.Box style={{...Styles.globalStyles.flexBoxColumn, alignItems: 'center'}}>
      <Kb.Text center={true} type="BodySmallSemibold" negative={true}>
        Create a team? You’ll be able to add and remove members as you wish.{' '}
      </Kb.Text>
      <Kb.Text
        type="BodySmallSemiboldPrimaryLink"
        style={{color: Styles.globalColors.white}}
        onClick={onShowNewTeamDialog}
        underline={true}
        className="underline"
        negative={true}
      >
        Enter a team name
      </Kb.Text>
    </Kb.Box>
  </Kb.Box>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        backgroundColor: Styles.globalColors.blue,
        justifyContent: 'center',
        paddingBottom: Styles.globalMargins.tiny,
        paddingLeft: Styles.globalMargins.medium,
        paddingRight: Styles.globalMargins.medium,
        paddingTop: Styles.globalMargins.tiny,
      },
    } as const)
)

export default CreateTeamHeader
