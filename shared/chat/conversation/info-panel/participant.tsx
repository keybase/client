import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type Props = {
  fullname: string
  isAdmin: boolean
  isOwner: boolean
  username: string
  botAlias: string
  onShowProfile: (username: string) => void
}

const Participant = ({botAlias, fullname, isAdmin, isOwner, username, onShowProfile}: Props) => {
  const lower = (
    <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" gap="xtiny">
      {fullname !== '' && <Kb.Text type="BodySmall">{fullname}</Kb.Text>}
      {(isAdmin || isOwner) && (
        <Kb.Box2 direction="horizontal" alignItems="center" gap="xxtiny">
          <Kb.Text type="BodySmall">(</Kb.Text>
          <Kb.Icon
            color={isOwner ? Styles.globalColors.yellowDark : Styles.globalColors.black_35}
            fontSize={10}
            type="iconfont-crown-owner"
          />
          <Kb.Text type="BodySmall">{isAdmin ? 'Admin' : 'Owner'}</Kb.Text>
          <Kb.Text type="BodySmall">)</Kb.Text>
        </Kb.Box2>
      )}
    </Kb.Box2>
  )
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
      <Kb.ClickableBox key={username} onClick={() => onShowProfile(username)}>
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.rowContainer}>
          <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.row}>
            <Kb.NameWithIcon
              botAlias={botAlias}
              horizontal={true}
              colorFollowing={true}
              username={username}
              metaOne={lower}
            />
          </Kb.Box2>
        </Kb.Box2>
      </Kb.ClickableBox>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        paddingTop: Styles.globalMargins.tiny,
      },
      row: {
        alignItems: 'center',
        flex: 1,
        marginRight: Styles.globalMargins.tiny,
      },
      rowContainer: Styles.platformStyles({
        common: {
          minHeight: 48,
          paddingLeft: Styles.globalMargins.small,
          paddingRight: Styles.globalMargins.small,
        },
        isElectron: {
          ...Styles.desktopStyles.clickable,
        },
        isMobile: {
          minHeight: 56,
        },
      }),
    } as const)
)

export default Participant
