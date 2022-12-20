import * as React from 'react'
import type * as Types from '../../../../constants/types/chat2'
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
    const {you, onManageChannels, message} = this.props
    const {team, author} = message
    return (
      <UserNotice>
        <Kb.Text type="BodySmall">
          {author === you ? 'You ' : ''}made <Kb.Text type="BodySmallBold">{team}</Kb.Text> a big team! Note
          that:
        </Kb.Text>
        <Kb.Box2
          direction="vertical"
          alignSelf="flex-start"
          gap="tiny"
          style={{marginLeft: Styles.globalMargins.tiny, marginTop: Styles.globalMargins.xtiny}}
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
