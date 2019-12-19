import React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

export type Props = {
  onSubmit: (description: string) => void
  onClose: () => void
  origDescription: string
  teamname: string
  waitingKey: string
}

const EditTeamDescription = (props: Props) => {
  const {origDescription, teamname, onClose, onSubmit, waitingKey} = props
  const [description, setDescription] = React.useState(origDescription)
  const onSave = React.useCallback(() => {
    onSubmit(description)
  }, [description, onSubmit])

  return (
    <Kb.MaybePopup onClose={onClose} cover={false}>
      <Kb.Box
        style={{
          ...Styles.globalStyles.flexBoxColumn,
          alignItems: 'center',
          padding: Styles.globalMargins.large,
        }}
      >
        <Kb.Avatar isTeam={true} teamname={teamname} size={64} />
        <Kb.Text
          style={{paddingBottom: Styles.globalMargins.medium, paddingTop: Styles.globalMargins.xtiny}}
          type="BodyBig"
        >
          {teamname}
        </Kb.Text>
        <Kb.Input
          hintText="Brief description"
          onChangeText={setDescription}
          value={description}
          multiline={true}
          style={{alignSelf: 'stretch', flexGrow: 1}}
          autoFocus={true}
        />
        <Kb.ButtonBar>
          <Kb.Button label="Cancel" onClick={onClose} type="Dim" />
          <Kb.WaitingButton
            disabled={description === origDescription}
            label="Save"
            onClick={onSave}
            waitingKey={waitingKey}
          />
        </Kb.ButtonBar>
      </Kb.Box>
    </Kb.MaybePopup>
  )
}

export default EditTeamDescription
