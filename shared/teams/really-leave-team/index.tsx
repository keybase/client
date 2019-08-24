import * as React from 'react'
import * as Constants from '../../constants/teams'
import {
  Avatar,
  Box,
  ConfirmModal,
  HeaderOnMobile,
  Icon,
  MaybePopup,
  ProgressIndicator,
} from '../../common-adapters'
import {globalStyles, globalMargins} from '../../styles'

export type Props = {
  onBack: () => void
  onLeave: () => void
  name: string
  title: string
}

const _Spinner = (props: Props) => (
  <MaybePopup onClose={props.onBack}>
    <Box
      style={{...globalStyles.flexBoxColumn, alignItems: 'center', flex: 1, padding: globalMargins.xlarge}}
    >
      <ProgressIndicator style={{width: globalMargins.medium}} />
    </Box>
  </MaybePopup>
)
const Spinner = HeaderOnMobile(_Spinner)

const Header = (props: Props) => (
  <>
    <Avatar teamname={props.name} size={64} />
    <Icon type="icon-team-leave-28" style={{marginRight: -60, marginTop: -20, zIndex: 1}} />
  </>
)

const _ReallyLeaveTeam = (props: Props) => (
  <ConfirmModal
    confirmText="Leave team"
    description={`You will lose access to all the ${
      props.name
    } chats and folders, and you won't be able to get back
    unless an admin invites you.`}
    header={<Header {...props} />}
    onCancel={props.onBack}
    onConfirm={props.onLeave}
    prompt={`Are you sure you want to leave ${props.name}?`}
    waitingKey={Constants.leaveTeamWaitingKey(props.name)}
  />
)

export default _ReallyLeaveTeam
export {Spinner}
