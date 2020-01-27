import * as React from 'react'
import * as Constants from '../../constants/teams'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {useTeamsSubscribe} from '../../teams/subscriber'

export type Props = {
  error: string
  clearErrors: () => void
  onBack: () => void
  onDeleteTeam: () => void
  onLeave: () => void
  name: string
  open?: boolean
}

const _Spinner = (props: Props) => (
  <Kb.MaybePopup onClose={props.onBack}>
    <Kb.Box2 direction="vertical" style={styles.spinnerContainer}>
      <Kb.ProgressIndicator style={styles.spinnerProgressIndicator} />
    </Kb.Box2>
  </Kb.MaybePopup>
)
const Spinner = Kb.HeaderOnMobile(_Spinner)

const Header = (props: Props) => (
  <>
    <Kb.Avatar teamname={props.name} size={64} />
    <Kb.Icon type="icon-team-leave-28" style={styles.headerIcon} />
  </>
)

const _ReallyLeaveTeam = (props: Props) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => () => props.clearErrors(), [])
  useTeamsSubscribe()
  return (
    <Kb.ConfirmModal
      error={props.error}
      confirmText="Leave team"
      description={`You will lose access to all the ${props.name} chats and folders${
        !props.open ? ', and you won’t be able to get back unless an admin invites you' : ''
      }.`}
      header={<Header {...props} />}
      onCancel={props.onBack}
      onConfirm={props.onLeave}
      prompt={`Are you sure you want to leave ${props.name}?`}
      waitingKey={Constants.leaveTeamWaitingKey(props.name)}
    />
  )
}

const styles = Styles.styleSheetCreate(() => ({
  headerIcon: {
    marginRight: -60,
    marginTop: -20,
    zIndex: 1,
  },
  spinnerContainer: {
    alignItems: 'center',
    flex: 1,
    padding: Styles.globalMargins.xlarge,
  },
  spinnerProgressIndicator: {
    width: Styles.globalMargins.medium,
  },
}))

export default _ReallyLeaveTeam
export {Spinner}
