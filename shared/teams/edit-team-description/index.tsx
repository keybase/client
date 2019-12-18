import React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

export type Props = {
  description: string
  onChangeDescription: (description: string) => void
  onSetDescription: () => void
  onClose: () => void
  origDescription: string
  teamname: string
  waitingKey: string
}

const EditTeamDescription = ({
  description,
  origDescription,
  teamname,
  onChangeDescription,
  onClose,
  onSetDescription,
  waitingKey,
}: Props) => (
  <Kb.Box2 alignItems="center" direction="vertical" style={styles.container}>
    <Kb.Avatar isTeam={true} teamname={teamname} size={64} />
    <Kb.Text style={styles.title} type="BodyBig">
      {teamname}
    </Kb.Text>
    <Kb.LabeledInput
      placeholder="Team description"
      onChangeText={onChangeDescription}
      value={description}
      multiline={true}
      autoFocus={true}
    />
    <Kb.ButtonBar fullWidth={true} style={styles.buttonBar}>
      <Kb.Button label="Cancel" onClick={onClose} type="Dim" />
      <Kb.WaitingButton
        disabled={description === origDescription}
        label="Save"
        onClick={onSetDescription}
        waitingKey={waitingKey}
      />
    </Kb.ButtonBar>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate(() => ({
  buttonBar: {alignItems: 'center'},
  container: Styles.platformStyles({
    common: {...Styles.padding(Styles.globalMargins.small, Styles.globalMargins.small, 0)},
    isElectron: {
      maxHeight: 560,
      width: 400,
    },
    isMobile: {width: '100%'},
  }),
  title: {
    paddingBottom: Styles.globalMargins.medium,
    paddingTop: Styles.globalMargins.xtiny,
  },
}))

export default EditTeamDescription
