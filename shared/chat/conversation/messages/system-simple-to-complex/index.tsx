import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import UserNotice from '../user-notice'

type Props = {
  message: Types.MessageSystemSimpleToComplex
  onManageChannels: () => void
  onViewTeam: () => void
  you: string
}

const bullet = '\u2022 '

class ComplexTeamNotice extends React.PureComponent<Props> {
  render() {
    const {team, author} = this.props.message
    const {you, onManageChannels} = this.props
    const authorComponent =
      author === you ? (
        'You'
      ) : (
        <Kb.ConnectedUsernames
          onUsernameClicked="profile"
          inline={true}
          type="BodySmallSemibold"
          colorFollowing={true}
          underline={true}
          usernames={[author]}
        />
      )
    return (
      <UserNotice>
        <Kb.Text type="BodySmall">
          {authorComponent} made <Kb.Text type="BodySmallBold">{team}</Kb.Text> a big team! Note that:
        </Kb.Text>
        <Kb.Box2
          direction="vertical"
          alignSelf="flex-start"
          gap="tiny"
          style={{marginTop: Styles.globalMargins.xtiny, marginLeft: Styles.globalMargins.tiny}}
        >
          <Kb.Text type="BodySmall">
            <Kb.Text type="BodySmall" style={styles.bullet}>
              {bullet}
            </Kb.Text>
            Your team channels will now appear in the "Big teams" section of the inbox.
          </Kb.Text>

          <Kb.Text type="BodySmall">
            <Kb.Text type="BodySmall" style={styles.bullet}>
              {bullet}
            </Kb.Text>
            Everyone can now create and join channels.{' '}
            <Kb.Text
              onClick={onManageChannels}
              type="BodySmallSemiboldSecondaryLink"
              style={{color: Styles.globalColors.blueDark}}
            >
              Browse other channels
            </Kb.Text>
          </Kb.Text>
        </Kb.Box2>
      </UserNotice>
    )
  }
}

const styles = Styles.styleSheetCreate(() => ({
  bullet: {
    marginRight: Styles.globalMargins.small,
  },
}))

export default ComplexTeamNotice
