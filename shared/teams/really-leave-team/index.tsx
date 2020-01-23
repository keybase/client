import * as React from 'react'
import * as Constants from '../../constants/teams'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as WaitingGen from '../../actions/waiting-gen'
import * as Container from '../../util/container'
import {useTeamsSubscribe} from '../../teams/subscriber'

export type Props = {
  error: string
  onBack: () => void
  onDeleteTeam: () => void
  onLeave: () => void
  name: string
  open?: boolean
}

const _Spinner = (props: Props) => (
  <Kb.MaybePopup onClose={props.onBack}>
    <Kb.Box
      style={{
        ...Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        flex: 1,
        padding: Styles.globalMargins.xlarge,
      }}
    >
      <Kb.ProgressIndicator style={{width: Styles.globalMargins.medium}} />
    </Kb.Box>
  </Kb.MaybePopup>
)
const Spinner = Kb.HeaderOnMobile(_Spinner)

const Header = (props: Props) => (
  <>
    <Kb.Avatar teamname={props.name} size={64} />
    <Kb.Icon type="icon-team-leave-28" style={{marginRight: -60, marginTop: -20, zIndex: 1}} />
  </>
)

const _ReallyLeaveTeam = (props: Props) => {
  const {name} = props
  const dispatch = Container.useDispatch()
  React.useEffect(
    () => () => dispatch(WaitingGen.createClearWaiting({key: Constants.leaveTeamWaitingKey(name)})),
    [name, dispatch]
  )
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

export default _ReallyLeaveTeam
export {Spinner}
