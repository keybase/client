import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import * as PeopleGen from '../../actions/people-gen'
import type * as RPCTypes from '../../constants/types/rpc-gen'
import * as Styles from '../../styles'
import PeopleItem, {type TaskButton} from '../item'
import {WotStatusType} from '../../constants/types/rpc-gen'

type Props = {
  key: string
  onClickUser: (username: string) => void
  status: RPCTypes.WotStatusType
  vouchee: string
  voucher: string
}

const makeButtons = (
  props: Props,
  onDismiss: (voucher: string, vouchee: string) => void
): Array<TaskButton> => {
  const dismissButton = {
    label: 'Dismiss',
    mode: 'Secondary',
    onClick: () => onDismiss(props.voucher, props.vouchee),
  } as TaskButton
  switch (props.status) {
    case WotStatusType.proposed:
      return [
        {
          label: 'Review claim',
          onClick: () => props.onClickUser(props.vouchee),
        },
        dismissButton,
      ]
    case WotStatusType.accepted:
      return [
        {
          label: 'Review claim',
          onClick: () => props.onClickUser(props.vouchee),
        },
        dismissButton,
      ]
    case WotStatusType.rejected:
      return [
        {
          label: 'Edit claim',
          onClick: () => props.onClickUser(props.vouchee),
        },
        dismissButton,
      ]
    default:
      return []
  }
}

const makeMessage = (props: Props) => {
  const connectedUsernamesProps = {
    colorFollowing: true,
    inline: true,
    joinerStyle: {
      fontWeight: 'normal',
    },
    onUsernameClicked: 'profile',
    type: 'BodyBold',
    underline: true,
  } as const
  const voucherComponent = (
    <Kb.ConnectedUsernames
      {...connectedUsernamesProps}
      usernames={props.voucher}
      onUsernameClicked={props.onClickUser}
    />
  )
  const voucheeComponent = (
    <Kb.ConnectedUsernames
      {...connectedUsernamesProps}
      usernames={props.vouchee}
      onUsernameClicked={props.onClickUser}
    />
  )
  switch (props.status) {
    case WotStatusType.proposed:
      return <Kb.Text type="Body">{voucherComponent} submitted an entry to your web of trust.</Kb.Text>
    case WotStatusType.accepted:
      return <Kb.Text type="Body">{voucheeComponent} accepted your entry into their web of trust.</Kb.Text>
    case WotStatusType.rejected:
      return <Kb.Text type="Body">{voucheeComponent} rejected your entry into their web of trust.</Kb.Text>
    default:
      return <Kb.Text type="Body">unknown.</Kb.Text>
  }
}

const WotTask = (props: Props) => {
  const dispatch = Container.useDispatch()
  const myUsername = Container.useSelector(state => state.config.username)
  const otherUser = myUsername.localeCompare(props.voucher) === 0 ? props.vouchee : props.voucher
  const badged = true
  const onDismiss = (voucher: string, vouchee: string) => {
    dispatch(PeopleGen.createDismissWotNotifications({vouchee, voucher}))
  }

  return (
    <Kb.ClickableBox onClick={() => props.onClickUser(props.vouchee)}>
      <PeopleItem
        badged={badged}
        icon={
          <Kb.Avatar
            username={otherUser}
            onClick={() => props.onClickUser(otherUser)}
            size={Styles.isMobile ? 48 : 32}
          />
        }
        buttons={makeButtons(props, onDismiss)}
      >
        {makeMessage(props)}
      </PeopleItem>
    </Kb.ClickableBox>
  )
}

export default WotTask
