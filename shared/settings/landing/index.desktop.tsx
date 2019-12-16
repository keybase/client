import * as React from 'react'
import * as Styles from '../../styles'
import {Box, Button, Checkbox, Divider, Text} from '../../common-adapters'
import {Props, AccountProps} from '.'

const ROW_HEIGHT = 48

function AccountEmail({email, onChangeEmail}: {email: string; onChangeEmail: () => void}) {
  return (
    <Box
      style={{
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: ROW_HEIGHT,
      }}
    >
      <Box style={Styles.globalStyles.flexBoxColumn}>
        <Text type="BodySemibold">{email}</Text>
      </Box>
      <Text type="Body" style={{color: Styles.globalColors.blueDark}} onClick={onChangeEmail}>
        Edit
      </Text>
    </Box>
  )
}

function AccountFirstEmail({onChangeEmail}: {onChangeEmail: () => void}) {
  return (
    <Box
      style={{
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        minHeight: ROW_HEIGHT,
      }}
    >
      <Text type="Body" style={{marginRight: Styles.globalMargins.xtiny}}>
        Email address:
      </Text>
      <Button label="Add an email address" type="Dim" small={true} onClick={onChangeEmail} />
    </Box>
  )
}

function AccountPassword({onChangePassword}: {onChangePassword: () => void}) {
  return (
    <Box style={{...Styles.globalStyles.flexBoxRow, alignItems: 'center', minHeight: ROW_HEIGHT}}>
      <Text type="Body" style={{marginRight: Styles.globalMargins.xtiny}}>
        Password:
      </Text>
      <Text type="Body" style={{flex: 1}}>
        •••••••••
      </Text>
      <Text type="Body" style={{color: Styles.globalColors.blueDark}} onClick={onChangePassword}>
        Edit
      </Text>
    </Box>
  )
}

function AccountFirstPassword({onChangePassword}: {onChangePassword: () => void}) {
  return (
    <Box style={{...Styles.globalStyles.flexBoxRow, alignItems: 'center', minHeight: ROW_HEIGHT}}>
      <Text type="Body" style={{marginRight: Styles.globalMargins.xtiny}}>
        Password:
      </Text>
      <Button label="Set a password" type="Dim" small={true} onClick={onChangePassword} />
    </Box>
  )
}

function Account({
  email,
  onChangeEmail,
  onChangePassword,
  onChangeRememberPassword,
  rememberPassword,
  hasRandomPW,
}: AccountProps) {
  const Password = hasRandomPW ? AccountFirstPassword : AccountPassword
  const Email = email ? AccountEmail : AccountFirstEmail
  return (
    <Box style={{...Styles.globalStyles.flexBoxColumn, marginBottom: Styles.globalMargins.medium}}>
      <Email email={email} onChangeEmail={onChangeEmail} />
      <Divider />
      <Password onChangePassword={onChangePassword} />
      <Divider />
      {!hasRandomPW && (
        <Checkbox
          checked={rememberPassword}
          label="Remember my password"
          onCheck={onChangeRememberPassword}
          style={{paddingTop: Styles.globalMargins.small}}
        />
      )}
    </Box>
  )
}

function Landing(props: Props) {
  return (
    <Box style={{...Styles.globalStyles.flexBoxColumn, flex: 1, padding: Styles.globalMargins.medium}}>
      <Account {...props.account} />
    </Box>
  )
}

export default Landing
