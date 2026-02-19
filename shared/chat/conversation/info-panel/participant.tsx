import * as Kb from '@/common-adapters'

type Props = {
  firstItem: boolean
  fullname: string
  isAdmin: boolean
  isOwner: boolean
  username: string
  onShowProfile: (username: string) => void
}

const Participant = ({firstItem, fullname, isAdmin, isOwner, username, onShowProfile}: Props) => {
  const lower = (
    <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" gap="xtiny">
      {fullname !== '' && <Kb.Text3 type="BodySmall">{fullname}</Kb.Text3>}
      {(isAdmin || isOwner) && (
        <Kb.Box2 direction="horizontal" alignItems="center" gap="xxtiny">
          <Kb.Text3 type="BodySmall">(</Kb.Text3>
          <Kb.Icon
            color={isOwner ? Kb.Styles.globalColors.yellowDark : Kb.Styles.globalColors.black_35}
            fontSize={10}
            type="iconfont-crown-owner"
          />
          <Kb.Text3 type="BodySmall">{isAdmin ? 'Admin' : 'Owner'}</Kb.Text3>
          <Kb.Text3 type="BodySmall">)</Kb.Text3>
        </Kb.Box2>
      )}
    </Kb.Box2>
  )
  return (
    <Kb.ListItem2
      onClick={() => onShowProfile(username)}
      firstItem={firstItem}
      type="Large"
      icon={<Kb.Avatar size={Kb.Styles.isMobile ? 48 : 32} username={username} />}
      body={
        <Kb.Box2 direction="vertical">
          <Kb.ConnectedUsernames usernames={username} colorFollowing={true} type="BodyBold" />
          {lower}
        </Kb.Box2>
      }
    />
  )
}

export default Participant
