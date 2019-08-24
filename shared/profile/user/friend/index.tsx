import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type Props = {
  fullname: string
  onClick: () => void
  username: string
  width: number
}

class Friend extends React.PureComponent<Props> {
  render() {
    const p = this.props
    return (
      <Kb.ClickableBox onClick={p.onClick} style={{width: p.width}}>
        <Kb.Box2
          direction="vertical"
          style={Styles.collapseStyles([styles.container, {width: p.width}])}
          centerChildren={true}
        >
          <Kb.Avatar size={64} username={p.username} style={styles.avatar} showFollowingStatus={true} />
          <Kb.ConnectedUsernames
            type={Styles.isMobile ? 'BodySmallSemibold' : 'BodySemibold'}
            usernames={[p.username]}
            colorBroken={true}
            colorFollowing={true}
          />
          <Kb.Text type="BodySmall" lineClamp={1} style={styles.fullname}>
            {p.fullname}
          </Kb.Text>
        </Kb.Box2>
      </Kb.ClickableBox>
    )
  }
}

const styles = Styles.styleSheetCreate({
  avatar: {marginBottom: Styles.globalMargins.xxtiny},
  container: {
    flexShrink: 0,
    height: 105,
    justifyContent: 'flex-start',
    minWidth: 0,
  },
  fullname: Styles.platformStyles({
    isElectron: {
      textAlign: 'center',
      whiteSpace: 'nowrap',
      width: 80,
      wordBreak: 'break-all',
    },
  }),
})

export default Friend
