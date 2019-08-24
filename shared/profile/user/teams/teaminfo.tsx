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

const Kb = {
  Box2,
  ConnectedUsernames,
  FloatingMenu,
  NameWithIcon,
  Text,
  WaitingButton,
}

type Props = {
  attachTo?: () => React.Component<any> | null
  description: string
  inTeam: boolean
  isOpen: boolean
  membersCount: number
  name: string
  onChat?: () => void
  onHidden: () => void
  onJoinTeam: (arg0: string) => void
  onViewTeam: (arg0: string) => void
  publicAdmins: Array<string>
  visible: boolean
}

class TeamInfo extends React.Component<Props, {requested: boolean}> {
  state = {requested: false}
  _isPrivate = () => {
    return this.props.membersCount === 0 && this.props.description.length === 0
  }
  _onJoinTeam = () => {
    this.props.onJoinTeam(this.props.name)
    this.setState({requested: true})
  }
  _onViewTeam = () => {
    this.props.onViewTeam(this.props.name)
    this.props.onHidden()
  }
  _onChat = () => {
    if (this.props.onChat) {
      this.props.onChat()
      this.props.onHidden()
    }
  }
  render() {
    const memberText = this._isPrivate()
      ? 'This team is private. Admins will decide if they can let you in.'
      : `${this.props.membersCount} member${this.props.membersCount > 1 ? 's' : ''}`
    return (
      <Kb.FloatingMenu
        attachTo={this.props.attachTo}
        closeOnSelect={false}
        onHidden={this.props.onHidden}
        visible={this.props.visible}
        propagateOutsideClicks={true}
        header={{
          title: 'header',
          view: (
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
                teamname={this.props.name}
                title={this.props.name}
                metaOne={<OpenMeta isOpen={this.props.isOpen} />}
                metaTwo={<Kb.Text type="BodySmall">{memberText}</Kb.Text>}
              />
              <Kb.Text type="Body" style={styles.description}>
                {this.props.description}
              </Kb.Text>
              {this.props.onChat && (
                <Kb.WaitingButton
                  waitingKey={Constants.waitingKey}
                  label="Chat"
                  onClick={this._onChat}
                  mode="Secondary"
                />
              )}
              {this.props.inTeam ? (
                <Kb.WaitingButton
                  waitingKey={Constants.waitingKey}
                  label="View team"
                  onClick={this._onViewTeam}
                  mode="Secondary"
                />
              ) : (
                <Kb.WaitingButton
                  waitingKey={Constants.waitingKey}
                  label={
                    this.state.requested ? 'Requested!' : this.props.isOpen ? 'Join team' : 'Request to join'
                  }
                  onClick={this.state.requested ? undefined : this._onJoinTeam}
                  type={this.props.isOpen ? 'Success' : 'Default'}
                  mode={this.state.requested ? 'Secondary' : 'Primary'}
                />
              )}
              {!!this.props.publicAdmins.length && (
                <Kb.Text center={true} type="BodySmall">
                  Public admins:{' '}
                  {
                    <Kb.ConnectedUsernames
                      type="BodySmallSemibold"
                      colorFollowing={true}
                      colorBroken={true}
                      onUsernameClicked="profile"
                      usernames={this.props.publicAdmins}
                      containerStyle={styles.publicAdmins}
                    />
                  }
                </Kb.Text>
              )}
            </Kb.Box2>
          ),
        }}
        position="bottom left"
        items={[]}
      />
    )
  }
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
