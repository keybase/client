import * as React from 'react'
import * as Kb from '@/common-adapters'

type Props = {
  fullname: string
  onClick: () => void
  username: string
  width: number
}

const Friend = React.memo(function Friend(p: Props) {
  return (
    <Kb.ClickableBox onClick={p.onClick} style={{width: p.width}}>
      <Kb.Box2
        direction="vertical"
        style={Kb.Styles.collapseStyles([styles.container, {width: p.width}])}
        centerChildren={true}
      >
        <Kb.Avatar size={64} username={p.username} style={styles.avatar} showFollowingStatus={true} />
        <Kb.ConnectedUsernames
          type={Kb.Styles.isMobile ? 'BodySmallBold' : 'BodyBold'}
          usernames={p.username}
          onUsernameClicked="profile"
          colorBroken={true}
          colorFollowing={true}
        />
        <Kb.Text2 type="BodySmall" lineClamp={1} style={styles.fullname}>
          {p.fullname}
        </Kb.Text2>
      </Kb.Box2>
    </Kb.ClickableBox>
  )
})

const styles = Kb.Styles.styleSheetCreate(() => ({
  avatar: {marginBottom: Kb.Styles.globalMargins.xxtiny},
  container: {
    flexShrink: 0,
    height: 105,
    justifyContent: 'flex-start',
    minWidth: 0,
  },
  fullname: Kb.Styles.platformStyles({
    isElectron: {
      textAlign: 'center',
      width: 80,
      wordBreak: 'break-all',
    },
    isMobile: {backgroundColor: Kb.Styles.globalColors.fastBlank},
  }),
}))

export default Friend
