import * as Kb from '@/common-adapters'
import type {AcceptedInvite, PendingInvite} from '@/constants/settings-invites'
import * as React from 'react'
import SubHeading from '../subheading'
import type {Props} from '.'
import * as dateFns from 'date-fns'

// Like intersperse but takes a function to define the separator
function intersperseFn<A, B>(
  separatorFn: (index: number, x: A, a: Array<A>) => B,
  arr: Array<A>
): Array<A | B> {
  if (arr.length === 0) {
    return arr
  }

  const toReturn = new Array(arr.length * 2 - 1)
  toReturn[0] = arr[0]
  for (let i = 1; i < arr.length; i++) {
    toReturn[i * 2 - 1] = separatorFn(i, arr[i]!, arr)
    toReturn[i * 2] = arr[i]
  }
  return toReturn
}

type State = {
  inviteEmail: string
  inviteMessage: string
  showMessageField: boolean
}

class Invites extends React.Component<Props, State> {
  state: State

  constructor(props: Props) {
    super(props)
    this.state = {
      inviteEmail: props.inviteEmail,
      inviteMessage: props.inviteMessage,
      showMessageField: props.showMessageField,
    }
  }

  componentDidMount() {
    this.props.onRefresh()
  }

  componentWillUnmount() {
    if (this.props.error) this.props.onClearError()
  }

  _handleChangeEmail(inviteEmail: string) {
    this.setState(s => ({
      inviteEmail,
      showMessageField: s.showMessageField || inviteEmail.length > 0,
    }))
    if (this.props.error) this.props.onClearError()
  }

  _invite() {
    this.props.onGenerateInvitation(this.state.inviteEmail, this.state.inviteMessage)
  }

  render() {
    const props = this.props
    return (
      <Kb.Box style={{...Kb.Styles.globalStyles.flexBoxColumn, flex: 1}}>
        {!!this.props.error && (
          <Kb.Banner color="red">
            <Kb.BannerParagraph bannerColor="red" content={this.props.error} />
          </Kb.Banner>
        )}
        <Kb.Box
          style={Kb.Styles.platformStyles({
            isElectron: {
              ...Kb.Styles.globalStyles.flexBoxColumn,
              flex: 1,
              overflow: 'auto',
              padding: Kb.Styles.globalMargins.medium,
            },
          })}
        >
          <Kb.Box2 direction="vertical" gap="small" style={styles.container}>
            <Kb.LabeledInput
              placeholder="Friend's email (optional)"
              value={this.state.inviteEmail}
              onChangeText={inviteEmail => this._handleChangeEmail(inviteEmail)}
              style={{marginBottom: 0}}
            />
            {this.state.showMessageField && (
              <Kb.LabeledInput
                placeholder="Message (optional)"
                multiline={true}
                value={this.state.inviteMessage}
                onChangeText={inviteMessage => this.setState({inviteMessage})}
              />
            )}
            <Kb.Button
              label="Generate invitation"
              onClick={() => this._invite()}
              waiting={props.waitingForResponse}
              style={{alignSelf: 'center', marginTop: Kb.Styles.globalMargins.medium}}
            />
          </Kb.Box2>
          {props.pendingInvites.length > 0 && (
            <Kb.Box style={{...Kb.Styles.globalStyles.flexBoxColumn, flexShrink: 0, marginBottom: 16}}>
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
          <Kb.Box style={{...Kb.Styles.globalStyles.flexBoxColumn, flexShrink: 0}}>
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

function intersperseDividers(arr: Array<React.ReactNode>) {
  return intersperseFn(i => <Kb.Divider key={i} />, arr)
}

function PendingInviteItem({
  invite,
  onReclaimInvitation,
  onSelectPendingInvite,
}: {
  invite: PendingInvite
  onReclaimInvitation: (id: string) => void
  onSelectPendingInvite: (invite: PendingInvite) => void
}) {
  return (
    <Kb.Box style={styles.inviteItem}>
      {invite.email ? (
        <PendingEmailContent invite={invite} onSelectPendingInvite={onSelectPendingInvite} />
      ) : (
        <PendingURLContent invite={invite} />
      )}
      <Kb.Box style={{flex: 1}} />
      <Kb.Text
        type="BodyPrimaryLink"
        onClick={() => onReclaimInvitation(invite.id)}
        style={{color: Kb.Styles.globalColors.redDark}}
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
  invite: PendingInvite
  onSelectPendingInvite: (invite: PendingInvite) => void
}) {
  return (
    <Kb.Box style={{...Kb.Styles.globalStyles.flexBoxRow, alignItems: 'center'}}>
      <Kb.Avatar size={32} />
      <Kb.Box style={{...Kb.Styles.globalStyles.flexBoxColumn, marginLeft: Kb.Styles.globalMargins.small}}>
        <Kb.Text type="BodySemibold" onClick={() => onSelectPendingInvite(invite)}>
          {invite.email}
        </Kb.Text>
        <Kb.Text type="BodySmall">
          Invited {dateFns.format(dateFns.fromUnixTime(invite.created), 'MMM d, yyyy')}
        </Kb.Text>
      </Kb.Box>
    </Kb.Box>
  )
}

function PendingURLContent({invite}: {invite: PendingInvite}) {
  return (
    <Kb.Box style={{...Kb.Styles.globalStyles.flexBoxRow, alignItems: 'center'}}>
      <Kb.Icon
        type="iconfont-link"
        style={{
          marginRight: Kb.Styles.globalMargins.tiny,
          marginTop: 3,
        }}
        color={Kb.Styles.globalColors.black_20}
        fontSize={13}
      />
      <Kb.Text type="Body" selectable={true} style={{color: Kb.Styles.globalColors.blueDark}}>
        {invite.url}
      </Kb.Text>
    </Kb.Box>
  )
}

function AcceptedInviteItem(p: {invite: AcceptedInvite; onClick: () => void}) {
  const {invite, onClick} = p
  return (
    <Kb.Box
      style={Kb.Styles.platformStyles({
        isElectron: {...styles.inviteItem, ...Kb.Styles.desktopStyles.clickable, flexShrink: 0},
      })}
      onClick={onClick}
    >
      <Kb.Avatar username={invite.username} size={32} />
      <Kb.Box style={{...Kb.Styles.globalStyles.flexBoxColumn, marginLeft: Kb.Styles.globalMargins.small}}>
        <Kb.ConnectedUsernames type="BodyBold" usernames={invite.username} />
      </Kb.Box>
    </Kb.Box>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: {
    marginTop: Kb.Styles.globalMargins.small,
    minHeight: 269,
    width: 400,
  },
  inviteItem: {
    ...Kb.Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    flexShrink: 0,
    height: 40,
    marginLeft: Kb.Styles.globalMargins.tiny,
    marginRight: Kb.Styles.globalMargins.tiny,
  },
}))

export default Invites
