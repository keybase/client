import * as C from '@/constants'
import * as React from 'react'
import * as Styles from '@/styles'
import FloatingMenu from '@/common-adapters/floating-menu'
import NameWithIcon from '@/common-adapters/name-with-icon'
import OpenMeta from './openmeta'
import Text from '@/common-adapters/text'
import WaitingButton from '@/common-adapters/waiting-button'
import {Box2} from '@/common-adapters/box'
import {type MeasureRef} from '@/common-adapters/measure-ref'
import ConnectedUsernames from '@/common-adapters/usernames'

const Kb = {
  Box2,
  ConnectedUsernames,
  FloatingMenu,
  NameWithIcon,
  Styles,
  Text,
  WaitingButton,
}

export type Props = {
  attachTo?: React.RefObject<MeasureRef | null>
  description: string
  inTeam: boolean
  isOpen: boolean
  membersCount: number
  name: string
  position?: Styles.Position
  onChat?: () => void
  onHidden: () => void
  onJoinTeam: (teamname: string) => void
  onViewTeam: () => void
  publicAdmins: ReadonlyArray<string>
  visible: boolean
}

const TeamInfo = ({
  attachTo,
  description,
  inTeam,
  isOpen,
  membersCount,
  name,
  onChat,
  onHidden,
  onJoinTeam,
  onViewTeam,
  position,
  publicAdmins,
  visible,
}: Props) => {
  const [requested, setRequested] = React.useState(false)
  const isPrivate = membersCount === 0 && description.length === 0
  const memberText = isPrivate
    ? 'This team is private. Admins will decide if they can let you in.'
    : `${membersCount} member${membersCount > 1 ? 's' : ''}`
  const joinLabel = requested ? 'Requested!' : isOpen ? 'Join team' : 'Request to join'

  const handleJoinTeam = () => {
    onJoinTeam(name)
    setRequested(true)
  }

  const handleViewTeam = () => {
    onViewTeam()
    onHidden()
  }

  const handleChat = () => {
    onChat?.()
    onHidden()
  }

  return (
    <Kb.FloatingMenu
      attachTo={attachTo}
      closeOnSelect={false}
      onHidden={onHidden}
      visible={visible}
      propagateOutsideClicks={true}
      header={
        <Kb.Box2
          centerChildren={true}
          direction="vertical"
          gap="tiny"
          gapStart={true}
          gapEnd={true}
          style={styles.infoPopup}
        >
          <Kb.NameWithIcon
            size="small"
            teamname={name}
            title={name}
            metaOne={<OpenMeta isOpen={isOpen} />}
            metaTwo={<Kb.Text type="BodySmall">{memberText}</Kb.Text>}
          />
          <Kb.Text type="Body" selectable={true} style={styles.description}>
            {description}
          </Kb.Text>
          {!!onChat && (
            <Kb.WaitingButton
              waitingKey={C.waitingKeyTracker}
              label="Chat"
              onClick={handleChat}
              mode="Secondary"
            />
          )}
          <Kb.WaitingButton
            waitingKey={C.waitingKeyTracker}
            label="View team"
            onClick={handleViewTeam}
            mode="Secondary"
          />
          {!inTeam && (
            <Kb.WaitingButton
              waitingKey={C.waitingKeyTracker}
              label={joinLabel}
              onClick={requested ? undefined : handleJoinTeam}
              type={isOpen ? 'Success' : 'Default'}
              mode={requested ? 'Secondary' : 'Primary'}
            />
          )}
          {!!publicAdmins.length && (
            <Kb.Text center={true} type="BodySmall">
              Public admins:{' '}
              <Kb.ConnectedUsernames
                type="BodySmallBold"
                colorFollowing={true}
                colorBroken={true}
                onUsernameClicked="profile"
                usernames={publicAdmins}
                containerStyle={styles.publicAdmins}
                lineClamp={5}
              />
            </Kb.Text>
          )}
        </Kb.Box2>
      }
      position={position ?? 'bottom left'}
      items={[]}
    />
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      description: Kb.Styles.platformStyles({
        common: {textAlign: 'center'},
        isElectron: {
          width: '100%',
          wordWrap: 'break-word',
        },
      }),
      infoPopup: {
        maxWidth: 225,
        padding: Kb.Styles.globalMargins.small,
      },
      publicAdmins: Kb.Styles.platformStyles({
        isElectron: {display: 'unset'},
      }),
    }) as const
)

export default TeamInfo
