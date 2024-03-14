import './account-switcher.css'
import * as Constants from '@/constants/config'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import type * as T from '@/constants/types'

export type AccountRowItem = {
  account: T.Config.ConfiguredAccount
  fullName: string
}

export type Props = {
  accountRows: Array<AccountRowItem>
  fullname: string
  onAddAccount: () => void
  onCancel: () => void
  onProfileClick: () => void
  onSelectAccount: (username: string) => void
  onSignOut: () => void
  username: string
  waiting: boolean
}

const MobileHeader = (props: Props) => (
  <>
    <Kb.Box2
      direction="vertical"
      gap="tiny"
      gapStart={true}
      centerChildren={true}
      gapEnd={true}
      style={styles.userBox}
    >
      <Kb.Avatar username={props.username} onClick={props.onProfileClick} size={128} />
      <Kb.Box2 direction="vertical" centerChildren={true}>
        <Kb.Text type="BodyBig" onClick={props.onProfileClick}>
          {props.username}
        </Kb.Text>
        <Kb.Text type="BodySmall" lineClamp={1} onClick={props.onProfileClick}>
          {props.fullname}
        </Kb.Text>
      </Kb.Box2>
      <Kb.Button fullWidth={true} label="View/Edit profile" mode="Secondary" onClick={props.onProfileClick} />
      <Kb.Divider style={styles.divider} />
    </Kb.Box2>
    <Kb.Box2 direction="vertical" style={styles.buttonBox} fullWidth={true} gap="tiny">
      <Kb.WaitingButton
        onClick={props.onAddAccount}
        label="Log in as another user"
        mode="Primary"
        fullWidth={true}
        waitingKey={Constants.loginAsOtherUserWaitingKey}
      />
    </Kb.Box2>
  </>
)

type AccountRowProps = {
  entry: AccountRowItem
  onSelectAccount: (user: string) => void
  waiting: boolean
}
const AccountRow = (props: AccountRowProps) => {
  const {waiting} = props
  const [clicked, setClicked] = React.useState(false)
  React.useEffect(() => {
    if (!waiting) {
      setClicked(false)
    }
  }, [setClicked, waiting])

  const onClick = waiting
    ? undefined
    : () => {
        setClicked(true)
        props.onSelectAccount(props.entry.account.username)
      }
  return (
    <Kb.ListItem2
      type={Kb.Styles.isMobile ? 'Large' : 'Small'}
      icon={<Kb.Avatar size={Kb.Styles.isMobile ? 48 : 32} username={props.entry.account.username} />}
      firstItem={true}
      body={
        <Kb.Box2 direction="vertical" fullWidth={true} style={waiting ? styles.waiting : undefined}>
          <Kb.Text type="BodySemibold">{props.entry.account.username}</Kb.Text>
          {(props.entry.fullName || !props.entry.account.hasStoredSecret) && (
            <Kb.Box2 direction="horizontal" alignItems="center" fullWidth={true}>
              <Kb.Text type="BodySmall" lineClamp={1} style={styles.nameText}>
                {props.entry.fullName}
              </Kb.Text>
              {!props.entry.account.hasStoredSecret && (
                <Kb.Text type="BodySmall" style={styles.text2}>
                  {props.entry.fullName && ' · '}Signed out
                </Kb.Text>
              )}
            </Kb.Box2>
          )}
          {clicked && <Kb.ProgressIndicator type="Large" style={styles.progressIndicator} />}
        </Kb.Box2>
      }
      onClick={onClick}
    />
  )
}

const AccountsRows = (props: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.accountRows}>
    {props.accountRows.map(entry => (
      <AccountRow
        entry={entry}
        onSelectAccount={props.onSelectAccount}
        waiting={props.waiting}
        key={entry.account.username}
      />
    ))}
  </Kb.Box2>
)

const AccountSwitcher = (props: Props) => (
  <Kb.HeaderHocWrapper
    leftAction="cancel"
    onCancel={props.onCancel}
    // else right isn't pushed over, will address in nav5
    title=" "
    rightActions={[{color: 'red', label: 'Sign out', onPress: props.onSignOut}]}
  >
    <Kb.ScrollView alwaysBounceVertical={false}>
      <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true}>
        {Kb.Styles.isMobile && <MobileHeader {...props} />}
        <Kb.Divider style={styles.divider} />
        {Kb.Styles.isMobile ? (
          <AccountsRows {...props} />
        ) : (
          <Kb.ScrollView style={styles.desktopScrollview} className="accountSwitcherScrollView">
            <AccountsRows {...props} />
          </Kb.ScrollView>
        )}
        {props.accountRows.length > 0 && !Kb.Styles.isMobile && <Kb.Divider style={styles.divider} />}
      </Kb.Box2>
    </Kb.ScrollView>
  </Kb.HeaderHocWrapper>
)

export default AccountSwitcher

const styles = Kb.Styles.styleSheetCreate(() => ({
  accountRows: Kb.Styles.platformStyles({
    isTablet: {maxWidth: Kb.Styles.globalStyles.mediumWidth},
  }),
  buttonBox: Kb.Styles.padding(0, Kb.Styles.globalMargins.small, Kb.Styles.globalMargins.tiny),
  desktopScrollview: {
    width: '100%',
  },
  divider: {width: '100%'},
  nameText: Kb.Styles.platformStyles({
    common: {flexShrink: 1},
    isElectron: {wordBreak: 'break-all'},
  }),
  progressIndicator: {bottom: 0, position: 'absolute', right: 0},
  row: {
    paddingBottom: -Kb.Styles.globalMargins.small,
    paddingTop: -Kb.Styles.globalMargins.small,
  },
  text2: {flexShrink: 0},
  userBox: {
    paddingLeft: Kb.Styles.globalMargins.small,
    paddingRight: Kb.Styles.globalMargins.small,
    width: '100%',
  },
  waiting: {
    opacity: 0.5,
  },
}))
