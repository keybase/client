import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'

const InviteFriends = () => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onClose = () => dispatch(nav.safeNavigateUpPayload())
  return (
    <Kb.Modal
      mode="DefaultFullHeight"
      onClose={onClose}
      header={{title: Styles.isMobile ? 'Invite friends' : 'Invite your friends to Keybase'}}
    >
      <Kb.Text type="BodySmall">By email address</Kb.Text>
    </Kb.Modal>
  )
}

export default InviteFriends
