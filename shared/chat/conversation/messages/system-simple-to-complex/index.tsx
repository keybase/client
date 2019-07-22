import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import UserNotice from '../user-notice'
import * as Kb from '../../../../common-adapters'
import {globalColors, globalMargins} from '../../../../styles'
import SystemMessageTimestamp from '../system-message-timestamp'

type Props = {
  message: Types.MessageSystemSimpleToComplex
  onManageChannels: () => void
  onViewTeam: (teamname: string) => void
  you: string
}

const bullet = '\u2022'

class ComplexTeamNotice extends React.PureComponent<Props> {
  render() {
    const {team, author, timestamp} = this.props.message
    const {you, onManageChannels, onViewTeam} = this.props
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
      <UserNotice
        style={{marginTop: globalMargins.small}}
        teamname={team || ''}
        bgColor={globalColors.blueLighter2}
        onClickAvatar={() => onViewTeam(team)}
      >
        <SystemMessageTimestamp timestamp={timestamp} />
        <Kb.Box2 direction="vertical">
          <Kb.Text center={true} type="BodySmallSemibold">
            {authorComponent} made {team} a big team!
          </Kb.Text>
          <Kb.Text center={true} type="BodySmallSemibold" style={{marginTop: globalMargins.tiny}}>
            Note that:
          </Kb.Text>
          <Kb.Box2 direction="vertical">
            <Kb.Box2 direction="horizontal" alignSelf="flex-start">
              <Kb.Text type="BodySmallSemibold" style={{marginRight: globalMargins.tiny}}>
                {bullet}
              </Kb.Text>
              <Kb.Text type="BodySmallSemibold">
                Your team channels will now appear in the "Big teams" section of the inbox.
              </Kb.Text>
            </Kb.Box2>
            <Kb.Box2 direction="horizontal" alignSelf="flex-start">
              <Kb.Text type="BodySmallSemibold" style={{marginRight: globalMargins.tiny}}>
                {bullet}
              </Kb.Text>
              <Kb.Text type="BodySmallSemibold">
                Everyone can now create and join channels.{' '}
                <Kb.Text
                  onClick={onManageChannels}
                  type="BodySmallSemiboldSecondaryLink"
                  style={{color: globalColors.blueDark}}
                >
                  Browse other channels
                </Kb.Text>
              </Kb.Text>
            </Kb.Box2>
          </Kb.Box2>
        </Kb.Box2>
      </UserNotice>
    )
  }
}

export default ComplexTeamNotice
