import * as React from 'react'
import * as Constants from '@/constants/tracker2'
import * as Styles from '@/styles'
import OpenMeta from './openmeta'
import FloatingMenu from '@/common-adapters/floating-menu'
import ConnectedUsernames from '@/common-adapters/usernames'
import NameWithIcon from '@/common-adapters/name-with-icon'
import Text from '@/common-adapters/text'
import {Box2} from '@/common-adapters/box'
import WaitingButton from '@/common-adapters/waiting-button'
import type {MeasureRef} from '@/common-adapters/measure-ref'

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
  attachTo?: React.RefObject<MeasureRef>
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

const TeamInfo = (props: Props) => {
  const [requested, setRequested] = React.useState(false)

  const _isPrivate = () => {
    return props.membersCount === 0 && props.description.length === 0
  }

  const _onJoinTeam = () => {
    props.onJoinTeam(props.name)
    setRequested(true)
  }

  const _onViewTeam = () => {
    props.onViewTeam()
    props.onHidden()
  }

  const _onChat = () => {
    if (props.onChat) {
      props.onChat()
      props.onHidden()
    }
  }

  const memberText = _isPrivate()
    ? 'This team is private. Admins will decide if they can let you in.'
    : `${props.membersCount} member${props.membersCount > 1 ? 's' : ''}`

  return (
    <Kb.FloatingMenu
      attachTo={props.attachTo}
      closeOnSelect={false}
      onHidden={props.onHidden}
      visible={props.visible}
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
            teamname={props.name}
            title={props.name}
            metaOne={<OpenMeta isOpen={props.isOpen} />}
            metaTwo={<Kb.Text type="BodySmall">{memberText}</Kb.Text>}
          />
          <Kb.Text type="Body" selectable={true} style={styles.description}>
            {props.description}
          </Kb.Text>
          {props.onChat && (
            <Kb.WaitingButton
              waitingKey={Constants.waitingKey}
              label="Chat"
              onClick={_onChat}
              mode="Secondary"
            />
          )}
          {/* With teamsRedesign we have external team page, always show view team button */}
          <Kb.WaitingButton
            waitingKey={Constants.waitingKey}
            label="View team"
            onClick={_onViewTeam}
            mode="Secondary"
          />
          {!props.inTeam && (
            <Kb.WaitingButton
              waitingKey={Constants.waitingKey}
              label={requested ? 'Requested!' : props.isOpen ? 'Join team' : 'Request to join'}
              onClick={requested ? undefined : _onJoinTeam}
              type={props.isOpen ? 'Success' : 'Default'}
              mode={requested ? 'Secondary' : 'Primary'}
            />
          )}
          {!!props.publicAdmins.length && (
            <Kb.Text center={true} type="BodySmall">
              Public admins:{' '}
              {
                <Kb.ConnectedUsernames
                  type="BodySmallBold"
                  colorFollowing={true}
                  colorBroken={true}
                  onUsernameClicked="profile"
                  usernames={props.publicAdmins}
                  containerStyle={styles.publicAdmins}
                />
              }
            </Kb.Text>
          )}
        </Kb.Box2>
      }
      position={props.position ?? 'bottom left'}
      items={[]}
    />
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      description: Kb.Styles.platformStyles({
        common: {
          textAlign: 'center',
        },
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
