import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import OpenMeta from './openmeta'
import type {MeasureRef} from '@/common-adapters/measure-ref'

export type Props = {
  attachTo?: React.RefObject<MeasureRef | null>
  description: string
  inTeam: boolean
  isOpen: boolean
  membersCount: number
  name: string
  position?: Kb.Styles.Position
  onChat?: () => void
  onHidden: () => void
  onJoinTeam: (teamname: string) => void
  onViewTeam: () => void
  publicAdmins: ReadonlyArray<string>
  visible: boolean
}

const TeamInfo = (props: Props) => {
  const [requested, setRequested] = React.useState(false)
  const {onChat, onHidden, onViewTeam, onJoinTeam, name} = props

  const isPrivate = props.membersCount === 0 && props.description.length === 0
  const memberText = isPrivate
    ? 'This team is private. Admins will decide if they can let you in.'
    : `${props.membersCount} member${props.membersCount > 1 ? 's' : ''}`

  return (
    <Kb.FloatingMenu
      attachTo={props.attachTo}
      closeOnSelect={false}
      mode="bottomsheet"
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
          padding="small"
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
              waitingKey={C.waitingKeyTracker}
              label="Chat"
              onClick={() => {
                onChat?.()
                onHidden()
              }}
              mode="Secondary"
            />
          )}
          <Kb.WaitingButton
            waitingKey={C.waitingKeyTracker}
            label="View team"
            onClick={() => {
              onViewTeam()
              onHidden()
            }}
            mode="Secondary"
          />
          {!props.inTeam && (
            <Kb.WaitingButton
              waitingKey={C.waitingKeyTracker}
              label={requested ? 'Requested!' : props.isOpen ? 'Join team' : 'Request to join'}
              onClick={
                requested
                  ? undefined
                  : () => {
                      onJoinTeam(name)
                      setRequested(true)
                    }
              }
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
                  lineClamp={5}
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
      },
      publicAdmins: Kb.Styles.platformStyles({
        isElectron: {display: 'unset'},
      }),
    }) as const
)

export default TeamInfo
