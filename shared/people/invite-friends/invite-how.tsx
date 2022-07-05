import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Container from '../../util/container'

type Props = {
  visible: boolean
  onHidden: () => void
  onShareLink: () => void
}
const InviteHow = (props: Props) => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const byPhoneOrEmail = () =>
    dispatch(nav.safeNavigateAppendPayload({path: [{selected: 'inviteFriendsModal'}]}))
  const invitePhoneContacts = () =>
    dispatch(nav.safeNavigateAppendPayload({path: [{selected: 'inviteFriendsContacts'}]}))

  const items: Kb.MenuItems = [
    {icon: 'iconfont-mention', onClick: byPhoneOrEmail, title: 'By email or phone number'},
    {icon: 'iconfont-contact-book', onClick: invitePhoneContacts, title: 'Invite phone contacts'},
    {icon: 'iconfont-link', onClick: props.onShareLink, title: 'Share a link'},
  ]
  const header = (
    <Kb.Box2 direction="horizontal" centerChildren={true} alignItems="center">
      <Kb.Text type="BodySmallSemibold">Invite friends</Kb.Text>
    </Kb.Box2>
  )
  return <Kb.FloatingMenu {...props} closeOnSelect={true} items={items} header={header} closeText="Cancel" />
}

export default InviteHow
