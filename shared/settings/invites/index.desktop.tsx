import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/settings'
import React, {Component} from 'react'
import SubHeading from '../subheading'
import moment from 'moment'
import {Props} from '.'
import {intersperseFn} from '../../util/arrays'

type State = {
  inviteEmail: string
  inviteMessage: string
  showMessageField: boolean
}

class Invites extends Component<Props, State> {
  state: State

  constructor(props: Props) {
    super(props)
    this.state = {
      inviteEmail: props.inviteEmail,
      inviteMessage: props.inviteMessage,
      showMessageField: props.showMessageField,
    }
  }
  componentWillUnmount() {
    if (this.props.error) this.props.onClearError()
  }

  _handleChangeEmail(inviteEmail: string) {
    const showMessageField = this.state.showMessageField || inviteEmail.length > 0
    this.setState({
      inviteEmail,
      showMessageField,
    })
    if (this.props.error) this.props.onClearError()
  }

  _invite() {
    this.props.onGenerateInvitation(this.state.inviteEmail, this.state.inviteMessage)
  }

  render() {
    const props = this.props
    return (
      <Kb.Box style={{...Styles.globalStyles.flexBoxColumn, flex: 1}}>
        {!!this.props.error && (
          <Kb.Banner color="red">
            <Kb.BannerParagraph bannerColor="red" content={this.props.error.message} />
          </Kb.Banner>
        )}
        <Kb.Box
          style={{
            ...Styles.globalStyles.flexBoxColumn,
            flex: 1,
            overflow: 'auto',
            padding: Styles.globalMargins.medium,
          }}
        >
          <Kb.Box
            style={{
              ...Styles.globalStyles.flexBoxColumn,
              alignItems: 'center',
              marginTop: Styles.globalMargins.small,
              minHeight: 269,
            }}
          >
            <Kb.Input
              hintText="Friend's email (optional)"
              value={this.state.inviteEmail}
              onChangeText={inviteEmail => this._handleChangeEmail(inviteEmail)}
              style={{marginBottom: 0}}
            />
            {this.state.showMessageField && (
              <Kb.Input
                hintText="Message (optional)"
                multiline={true}
                value={this.state.inviteMessage}
                onChangeText={inviteMessage => this.setState({inviteMessage})}
              />
            )}
            <Kb.Button
              label="Generate invitation"
              onClick={() => this._invite()}
              waiting={props.waitingForResponse}
              style={{alignSelf: 'center', marginTop: Styles.globalMargins.medium}}
            />
          </Kb.Box>
          {props.pendingInvites.length > 0 && (
            <Kb.Box style={{...Styles.globalStyles.flexBoxColumn, flexShrink: 0, marginBottom: 16}}>
              <SubHeading>Pending invites ({props.pendingInvites.length})</SubHeading>
              {intersperseDividers(
                props.pendingInvites.map(invite => (
                  <PendingInviteItem
                    invite={invite}
                    key={invite.id}
                    onReclaimInvitation={id => props.onReclaimInvitation(id)}
                    onSelectPendingInvite={invite => props.onSelectPendingInvite(invite)}
                  />
                ))
              )}
            </Kb.Box>
          )}
          <Kb.Box style={{...Styles.globalStyles.flexBoxColumn, flexShrink: 0}}>
            <SubHeading>Accepted invites ({props.acceptedInvites.length})</SubHeading>
            {intersperseDividers(
              props.acceptedInvites.map(invite => (
                <AcceptedInviteItem
                  key={invite.id}
                  invite={invite}
                  onClick={() => props.onSelectUser(invite.username)}
                />
              ))
            )}
          </Kb.Box>
        </Kb.Box>
      </Kb.Box>
    )
  }
}

function intersperseDividers(arr) {
  return intersperseFn(i => <Kb.Divider key={i} />, arr)
}

function PendingInviteItem({
  invite,
  onReclaimInvitation,
  onSelectPendingInvite,
}: {
  invite: Types.PendingInvite
  onReclaimInvitation: (id: string) => void
  onSelectPendingInvite: (invite: Types.PendingInvite) => void
}) {
  return (
    <Kb.Box style={styleInviteItem}>
      {invite.email ? (
        <PendingEmailContent invite={invite} onSelectPendingInvite={onSelectPendingInvite} />
      ) : (
        <PendingURLContent invite={invite} />
      )}
      <Kb.Box style={{flex: 1}} />
      <Kb.Text
        type="BodyPrimaryLink"
        onClick={() => onReclaimInvitation(invite.id)}
        style={{color: Styles.globalColors.redDark}}
      >
        Reclaim
      </Kb.Text>
    </Kb.Box>
  )
}

function PendingEmailContent({
  invite,
  onSelectPendingInvite,
}: {
  invite: Types.PendingInvite
  onSelectPendingInvite: (invite: Types.PendingInvite) => void
}) {
  return (
    <Kb.Box style={{...Styles.globalStyles.flexBoxRow, alignItems: 'center'}}>
      <Kb.Avatar size={32} />
      <Kb.Box style={{...Styles.globalStyles.flexBoxColumn, marginLeft: Styles.globalMargins.small}}>
        <Kb.Text type="BodySemibold" onClick={() => onSelectPendingInvite(invite)}>
          {invite.email}
        </Kb.Text>
        <Kb.Text type="BodySmall">Invited {moment.unix(invite.created).format('MMM D, YYYY')}</Kb.Text>
      </Kb.Box>
    </Kb.Box>
  )
}

function PendingURLContent({invite}: {invite: Types.PendingInvite}) {
  return (
    <Kb.Box style={{...Styles.globalStyles.flexBoxRow, alignItems: 'center'}}>
      <Kb.Icon
        type="iconfont-link"
        style={{
          marginRight: Styles.globalMargins.tiny,
          marginTop: 3,
        }}
        color={Styles.globalColors.black_20}
        fontSize={13}
      />
      <Kb.Text type="Body" selectable={true} style={{color: Styles.globalColors.blueDark}}>
        {invite.url}
      </Kb.Text>
    </Kb.Box>
  )
}

function AcceptedInviteItem({
  invite,
  onClick,
}: {
  invite: Types.AcceptedInvite
  onClick: (username: string) => void
}) {
  return (
    <Kb.Box style={{...styleInviteItem, ...Styles.desktopStyles.clickable, flexShrink: 0}} onClick={onClick}>
      <Kb.Avatar username={invite.username} size={32} />
      <Kb.Box style={{...Styles.globalStyles.flexBoxColumn, marginLeft: Styles.globalMargins.small}}>
        <Kb.ConnectedUsernames type="BodySemibold" usernames={[invite.username]} />
      </Kb.Box>
    </Kb.Box>
  )
}

const styleInviteItem = {
  ...Styles.globalStyles.flexBoxRow,
  alignItems: 'center',
  flexShrink: 0,
  height: 40,
  marginLeft: Styles.globalMargins.tiny,
  marginRight: Styles.globalMargins.tiny,
}

export default Invites
