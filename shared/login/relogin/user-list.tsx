import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import type * as T from '@/constants/types'

type Props = {
  users: Array<T.Config.ConfiguredAccount>
  selectedUser: string
  onSelectUser: (username: string) => void
  onSomeoneElse: () => void
}

const rowType = isMobile ? 'Large' : 'Small'
const rowHeight = isMobile ? Kb.largeListItemHeight : Kb.smallListItemHeight
const avatarSize = isMobile ? 48 : 32

type RowProps = {
  username: string
  hasStoredSecret: boolean
  selected: boolean
  firstItem: boolean
  waiting: boolean
  onSelectUser: (username: string) => void
}

// clicked/wasWaiting mirrors router-v2/account-switcher: spinner on the row that
// started the login, cleared when the waiting key clears
const UserRow = (p: RowProps) => {
  const {username, hasStoredSecret, selected, firstItem, waiting, onSelectUser} = p
  const [{clicked, wasWaiting}, setClickedState] = React.useState(() => ({
    clicked: false,
    wasWaiting: waiting,
  }))
  if (wasWaiting !== waiting) {
    setClickedState({clicked: waiting ? clicked : false, wasWaiting: waiting})
  }
  const onClick = waiting
    ? undefined
    : () => {
        setClickedState({clicked: hasStoredSecret, wasWaiting: waiting})
        onSelectUser(username)
      }
  return (
    <Kb.ListItem
      type={rowType}
      firstItem={firstItem}
      icon={<Kb.Avatar size={avatarSize} username={username} />}
      action={clicked ? <Kb.ProgressIndicator type="Large" /> : undefined}
      style={selected ? styles.selectedRow : undefined}
      body={
        <Kb.Box2 direction="vertical" fullWidth={true} style={waiting ? styles.waiting : undefined}>
          <Kb.Text type="BodySemibold">{username}</Kb.Text>
          <Kb.Text type="BodySmall">{hasStoredSecret ? 'Signed in' : 'Signed out'}</Kb.Text>
        </Kb.Box2>
      }
      onClick={onClick}
    />
  )
}

const UserList = (p: Props) => {
  const {users, selectedUser, onSelectUser, onSomeoneElse} = p
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyConfigLogin)
  return (
    <Kb.ScrollView style={styles.scroll} alwaysBounceVertical={false}>
      {users.map((u, idx) => (
        <UserRow
          key={u.username}
          username={u.username}
          hasStoredSecret={u.hasStoredSecret}
          selected={u.username === selectedUser && !u.hasStoredSecret}
          firstItem={idx === 0}
          waiting={waiting}
          onSelectUser={onSelectUser}
        />
      ))}
      <Kb.ListItem
        type={rowType}
        firstItem={users.length === 0}
        icon={<Kb.Avatar size={avatarSize} username="" />}
        body={
          <Kb.Box2 direction="vertical" fullWidth={true} style={waiting ? styles.waiting : undefined}>
            <Kb.Text type="BodySemibold">Someone else...</Kb.Text>
          </Kb.Box2>
        }
        onClick={waiting ? undefined : onSomeoneElse}
      />
    </Kb.ScrollView>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      scroll: {
        backgroundColor: Kb.Styles.globalColors.white,
        borderColor: Kb.Styles.globalColors.black_10,
        borderRadius: Kb.Styles.borderRadius,
        borderStyle: 'solid',
        borderWidth: 1,
        flexGrow: 0,
        flexShrink: 1,
        maxHeight: rowHeight * 5.5,
        minHeight: rowHeight * 2,
        width: '100%',
      },
      selectedRow: {backgroundColor: Kb.Styles.globalColors.blueLighter2},
      waiting: {opacity: 0.5},
    }) as const
)

export default UserList
