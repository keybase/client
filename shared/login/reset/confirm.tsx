import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {SignupScreen} from '../../signup/common'

const todo = () => console.log('todo')

const ConfirmReset = () => {
  const [check1, setCheck1] = React.useState(false)
  const [check2, setCheck2] = React.useState(false)
  const [check3, setCheck3] = React.useState(false)

  const onContinue = todo
  const onCancel = todo

  const disabled = !check1 || !check2 || !check3

  return (
    <SignupScreen
      title="Account reset"
      noBackground={true}
      buttons={[
        {disabled, label: 'Yes, reset account', onClick: onContinue, type: 'Danger'},
        {label: 'Cancel reset', onClick: onCancel, type: 'Dim'},
      ]}
    >
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        gap="medium"
        alignItems="center"
        style={styles.container}
      >
        <Kb.Icon type="iconfont-skull" sizeType="Big" />
        <Kb.Box2 direction="vertical" fullWidth={true} gap="small" alignItems="center">
          <Kb.Text type="Header">Go ahead with reset?</Kb.Text>
          <Kb.Box2 direction="vertical" fullWidth={true} gap="xsmall" alignItems="flex-start">
            <Kb.Box2 direction="vertical" alignItems="center" fullWidth={true}>
              <Kb.Text type="Body" center={true}>
                You can now fully reset your account.
              </Kb.Text>
              <Kb.Text type="Body" center={true}>
                Please check the boxes below:
              </Kb.Text>
            </Kb.Box2>
            <Kb.Checkbox
              label="You will lose your personal chats, files and git data."
              checked={check1}
              onCheck={setCheck1}
            />
            <Kb.Checkbox
              label="You will be removed from teams. If you were the last owner or admin of a team, it'll be orphaned and unrecoverable."
              checked={check2}
              onCheck={setCheck2}
            />
            <Kb.Checkbox
              label="Cryptographically, you'll be a whole new person."
              checked={check3}
              onCheck={setCheck3}
            />
          </Kb.Box2>
        </Kb.Box2>
      </Kb.Box2>
    </SignupScreen>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  container: Styles.platformStyles({
    isElectron: {
      width: 368,
    },
    isMobile: {
      padding: Styles.globalMargins.medium,
    },
  }),
}))

export default ConfirmReset
