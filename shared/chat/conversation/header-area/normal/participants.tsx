import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'

type Props = {
  participantToDisplayName: {[key: string]: string}
  participants: Array<string>
  onShowProfile: (username: string) => void
  textType: React.ComponentProps<typeof Kb.Text>['type']
}

const Participants = (props: Props) => (
  <>
    {props.participants.map((part, i, pLocal) => (
      <Kb.Text type={props.textType} key={part}>
        {props.participantToDisplayName[part] ? (
          <Kb.Text
            type={props.textType}
            onClick={() => props.onShowProfile(part)}
            className="hover-underline"
          >
            {props.participantToDisplayName[part]}
          </Kb.Text>
        ) : (
          <Kb.ConnectedUsernames
            colorFollowing={true}
            inline={true}
            underline={!Styles.isMobile}
            type={props.textType}
            usernames={[part]}
            onUsernameClicked="profile"
          />
        )}
        {i !== pLocal.length - 1 && ', '}
      </Kb.Text>
    ))}
  </>
)

export default Participants
