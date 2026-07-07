import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import ConfirmWarning from './confirm-warning'
import {useSettingsTabState} from './use-settings'

type Props = {
  isOpenTeam: boolean
  teamname: string
}

const OpenTeamWarning = (props: Props) => {
  const isOpenTeam = props.isOpenTeam
  const teamname = props.teamname
  const onConfirmCallback = useSettingsTabState(s => s.dispatch.triggerAllowOpen)

  const clearModals = C.Router2.clearModals
  const onConfirm = () => {
    clearModals()
    onConfirmCallback()
  }

  const onCancel = () => clearModals()

  return (
    <ConfirmWarning
      icon={<Kb.ImageIcon type={'icon-illustration-teams-216'} />}
      header={`Make ${teamname} into ${isOpenTeam ? 'an open' : 'a closed'} team?`}
      body={
        <>
          You are about to make this team{' '}
          {isOpenTeam ? 'publicly visible. Anyone will be able to join this team.' : 'private.'}
        </>
      }
      checkboxLabel={
        <>
          <Kb.Text type="Body">
            I understand that{' '}
            {isOpenTeam
              ? 'anyone will be able to join this team.'
              : 'members will only be able to join through adds or invites.'}
          </Kb.Text>
          <Kb.Text type="BodySmall">Subteams will not be affected.</Kb.Text>
        </>
      }
      confirmLabel={`Yes, set to ${isOpenTeam ? 'Open' : 'Private'}`}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}

export default OpenTeamWarning
