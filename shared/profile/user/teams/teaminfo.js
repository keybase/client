// @flow
import * as React from 'react'
import * as Styles from '../../../styles'
import * as Constants from '../../../constants/tracker2'
import OpenMeta from './openmeta'
import FloatingMenu from '../../../common-adapters/floating-menu'
import ConnectedUsernames from '../../../common-adapters/usernames/container'
import NameWithIcon from '../../../common-adapters/name-with-icon'
import Text from '../../../common-adapters/text'
import {Box2} from '../../../common-adapters/box'
import WaitingButton from '../../../common-adapters/waiting-button'

type Props = {|
  attachTo: () => ?React.Component<any>,
  description: string,
  inTeam: boolean,
  isOpen: boolean,
  membersCount: number,
  name: string,
  onHidden: () => void,
  onJoinTeam: string => void,
  publicAdmins: Array<string>,
  visible: boolean,
|}

const isPrivate = (p: Props) => {
  return p.membersCount === 0 && p.description.length === 0
}

const TeamInfo = (p: Props) => {
  const memberText = isPrivate(p)
    ? 'This team is private. Admins will decide if they can let you in.'
    : `${p.membersCount} member${p.membersCount > 1 ? 's' : ''}`
  return (
    <FloatingMenu
      attachTo={p.attachTo}
      closeOnSelect={false}
      onHidden={p.onHidden}
      visible={p.visible}
      header={{
        title: 'header',
        view: (
          <Box2
            centerChildren={true}
            direction="vertical"
            gap="tiny"
            gapStart={true}
            gapEnd={true}
            style={styles.infoPopup}
          >
            <NameWithIcon
              size="small"
              teamname={p.name}
              title={p.name}
              metaOne={<OpenMeta isOpen={p.isOpen} />}
              metaTwo={<Text type="BodySmall">{memberText}</Text>}
            />
            <Text type="Body" style={styles.description}>
              {p.description}
            </Text>
            {!p.inTeam && (
              <WaitingButton
                waitingKey={Constants.waitingKey}
                label={p.isOpen ? 'Join team' : 'Request to join'}
                onClick={() => p.onJoinTeam(p.name)}
                type={p.isOpen ? 'Success' : 'Default'}
              />
            )}
            {!!p.publicAdmins.length && (
              <Text center={true} type="BodySmall">
                Public admins:{' '}
                {
                  <ConnectedUsernames
                    type="BodySmallSemibold"
                    colorFollowing={true}
                    colorBroken={true}
                    onUsernameClicked="profile"
                    usernames={p.publicAdmins}
                    containerStyle={styles.publicAdmins}
                  />
                }
              </Text>
            )}
          </Box2>
        ),
      }}
      position="bottom left"
      items={[]}
    />
  )
}

const styles = Styles.styleSheetCreate({
  description: {textAlign: 'center'},
  infoPopup: {
    maxWidth: 225,
    padding: Styles.globalMargins.small,
  },
  publicAdmins: Styles.platformStyles({
    isElectron: {display: 'unset'},
  }),
})

export default TeamInfo
