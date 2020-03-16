import * as React from 'react'
import * as Constants from '../../../constants/teams'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as WaitingGen from '../../../actions/waiting-gen'
import * as Container from '../../../util/container'
import {useTeamsSubscribe} from '../../subscriber'

export type Props = {
  error: string
  onBack: () => void
  onDeleteTeam: () => void
  onLeave: (perm: boolean) => void
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
    <Kb.Icon boxStyle={styles.iconContainer} type="iconfont-leave" style={styles.headerIcon} />
  </>
)

const _ReallyLeaveTeam = (props: Props) => {
  const {name} = props
  const dispatch = Container.useDispatch()
  React.useEffect(
    () => () => dispatch(WaitingGen.createClearWaiting({key: Constants.leaveTeamWaitingKey(name)})),
    [name, dispatch]
  )
  const [leavePermanently, setLeavePermanently] = React.useState(false)
  const onLeave = () => props.onLeave(leavePermanently)
  useTeamsSubscribe()
  return (
    <Kb.ConfirmModal
      error={props.error}
      confirmText="Leave team"
      content={
        <Kb.Checkbox
          label="Block this team"
          labelSubtitle="Future attempts by admins to add you to the team will be ignored."
          onCheck={setLeavePermanently}
          checked={leavePermanently}
          style={styles.checkBox}
        />
      }
      description={`You will lose access to all the ${props.name} chats and folders${
        !props.open ? ', and you won’t be able to get back unless an admin invites you' : ''
      }.`}
      header={<Header {...props} />}
      onCancel={props.onBack}
      onConfirm={onLeave}
      prompt={`Leave ${props.name}?`}
      waitingKey={Constants.leaveTeamWaitingKey(props.name)}
    />
  )
}

const styles = Styles.styleSheetCreate(() => ({
  checkBox: Styles.platformStyles({
    common: {
      marginLeft: 48,
      marginRight: 48,
    },
    isMobile: {
      marginTop: 12,
    },
  }),
  // TODO: fix that this is an oval
  headerIcon: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.red,
      borderColor: Styles.globalColors.white,
      borderStyle: 'solid',
      borderWidth: 3,
      color: Styles.globalColors.white,
      padding: 4,
    },
    isElectron: {
      backgroundClip: 'padding-box',
      borderRadius: 50,
    },
    isMobile: {
      borderRadius: 18,
      marginRight: -46,
      marginTop: -30,
      zIndex: 1,
    },
  }),
  iconContainer: {
    marginRight: -46,
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
