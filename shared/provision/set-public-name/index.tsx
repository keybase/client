import * as Constants from '../../constants/provision'
import * as React from 'react'
import * as Kb from '../../common-adapters'
import {globalMargins, styleSheetCreate, isMobile, platformStyles} from '../../styles'

type Props = {
  onBack: () => void
  onChange: (deviceName: string) => void
  onSubmit: () => void | void
  deviceName: string
  error: string
}

const SetPublicName = (props: Props) => {
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} gap="medium" gapStart={true}>
      <Kb.Box2 direction="vertical" style={styles.contents} centerChildren={true} gap="medium">
      {props.error ? (
        <Kb.Banner color="red">{props.error}</Kb.Banner>
      ) : ([])}
        <Kb.Text type={isMobile ? 'Body' : 'Header'}>
          Set a public name for this new {isMobile ? 'phone' : 'computer'}:
        </Kb.Text>
        <Kb.Icon type={isMobile ? 'icon-phone-64' : 'icon-computer-64'} />
        <Kb.Input
          autoFocus={true}
          hintText="Pick a device name"
          onEnterKeyDown={props.onSubmit}
          onChangeText={props.onChange}
          value={props.deviceName}
        />
        <Kb.WaitingButton
          disabled={!props.onSubmit}
          label="Continue"
          onClick={props.onSubmit}
          waitingKey={Constants.waitingKey}
        />
        {props.onBack && <Kb.Button label="Back to my existing account" onClick={props.onBack} />}
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = styleSheetCreate({
  backButton: platformStyles({
    isElectron: {
      marginLeft: globalMargins.medium,
      marginTop: globalMargins.medium,
    },
    isMobile: {
      marginLeft: 0,
      marginTop: 0,
    },
  }),
  contents: {
    width: '100%',
  },
})

export default SetPublicName
