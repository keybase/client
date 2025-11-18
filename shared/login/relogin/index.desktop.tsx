import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import UserCard from '../user-card'
import {errorBanner, SignupScreen} from '@/signup/common'
import type {Props} from '.'

const other = 'Someone else...'

const UserRow = ({user, hasStoredSecret}: {user: string; hasStoredSecret: boolean}) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.userRow} gap="xtiny">
    <Kb.Text type="Header" style={user === other ? styles.other : styles.provisioned}>
      {user}
    </Kb.Text>
    {hasStoredSecret && <Kb.Text type="BodySmall"> • Signed in</Kb.Text>}
  </Kb.Box2>
)

const Login = (props: Props) => {
  const _inputRef = React.useRef<Kb.PlainInputRef>(null)

  const _onClickUserIdx = (selected: number) => {
    const user = props.users.at(selected)
    if (!user) {
      props.onSomeoneElse()
    } else {
      props.selectedUserChange(user.username)
      if (_inputRef.current) {
        _inputRef.current.focus()
      }
    }
  }

  const userRows = props.users
    .concat({hasStoredSecret: false, username: other})
    .map(u => <UserRow user={u.username} key={u.username} hasStoredSecret={u.hasStoredSecret} />)

  const selectedIdx = props.users.findIndex(u => u.username === props.selectedUser)
  return (
    <SignupScreen
      banners={errorBanner(props.error)}
      headerStyle={styles.header}
      onRightAction={props.onSignup}
      rightActionLabel="Create account"
      title="Log in"
    >
      <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} style={styles.contentBox}>
        <UserCard username={props.selectedUser} outerStyle={styles.container} style={styles.userContainer}>
          <Kb.Dropdown
            onChangedIdx={_onClickUserIdx}
            selected={userRows[selectedIdx]}
            items={userRows}
            overlayStyle={styles.userOverlayStyle}
            position="bottom center"
            style={styles.userDropdown}
          />
          {props.needPassword && (
            <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.inputRow}>
              <Kb.LabeledInput
                autoFocus={true}
                placeholder="Password"
                onChangeText={props.passwordChange}
                onEnterKeyDown={props.onSubmit}
                ref={_inputRef}
                type="password"
                value={props.password}
              />
            </Kb.Box2>
          )}
          <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.forgotPasswordContainer}>
            <Kb.Text
              type="BodySmallSecondaryLink"
              onClick={props.onForgotPassword}
              style={styles.forgotPassword}
            >
              Forgot password?
            </Kb.Text>
          </Kb.Box2>
          <Kb.Box2
            direction="vertical"
            fullWidth={true}
            fullHeight={true}
            style={styles.loginSubmitContainer}
          >
            <Kb.WaitingButton
              disabled={props.needPassword && !props.password}
              fullWidth={true}
              waitingKey={C.Config.loginWaitingKey}
              style={styles.loginSubmitButton}
              label="Log in"
              onClick={props.onSubmit}
            />
          </Kb.Box2>
        </UserCard>
      </Kb.Box2>
    </SignupScreen>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
        ...Kb.Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
      },
      contentBox: {
        alignSelf: 'center',
        flexGrow: 1,
        maxWidth: 460,
        padding: Kb.Styles.globalMargins.small,
      },
      forgotPassword: {
        marginTop: Kb.Styles.globalMargins.tiny,
      },
      forgotPasswordContainer: {
        flex: 1,
        justifyContent: 'flex-end',
      },
      header: {
        borderBottomWidth: 0,
      },
      inputRow: {
        flex: 1,
        marginBottom: 0,
        marginTop: Kb.Styles.globalMargins.tiny,
        width: '100%',
      },
      loginSubmitButton: {
        marginTop: 0,
        maxHeight: 32,
        width: '100%',
      },
      loginSubmitContainer: {
        flexGrow: 1,
        justifyContent: 'flex-end',
      },
      other: {color: Kb.Styles.globalColors.black},
      provisioned: {color: Kb.Styles.globalColors.orange},
      userContainer: {
        backgroundColor: Kb.Styles.globalColors.transparent,
        flex: 1,
      },
      userDropdown: {
        backgroundColor: Kb.Styles.globalColors.white,
        width: '100%',
      },
      userOverlayStyle: {
        backgroundColor: Kb.Styles.globalColors.white,
        width: 348,
      },
      userRow: {
        alignItems: 'center',
        marginLeft: Kb.Styles.globalMargins.xsmall,
        minHeight: 40,
        width: '100%',
      },
    }) as const
)

export default Login
