import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

export type Props = {
  username: string
  fullName?: React.ReactNode
  label?: React.ReactNode
}

const MenuHeader = (props: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} alignItems="center" style={styles.header}>
    <Kb.Avatar username={props.username} size={64} style={styles.avatar} />
    <Kb.ConnectedUsernames type="BodyBold" colorFollowing={true} usernames={props.username} />
    {!!props.fullName && (
      <Kb.Text type="BodySmall" center={true}>
        {props.fullName}
      </Kb.Text>
    )}
    {!!props.label && typeof props.label === 'string' ? (
      <Kb.Text type="BodySmall">{props.label}</Kb.Text>
    ) : (
      props.label
    )}
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate(() => ({
  avatar: {
    marginBottom: Styles.globalMargins.tiny,
  },
  header: Styles.platformStyles({
    isElectron: {
      padding: Styles.globalMargins.small,
    },
    isMobile: Styles.padding(
      Styles.globalMargins.medium,
      Styles.globalMargins.tiny,
      Styles.globalMargins.small
    ),
  }),
}))

export default MenuHeader
