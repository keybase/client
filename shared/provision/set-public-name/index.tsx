import * as Constants from '../../constants/provision'
import * as React from 'react'
import {Input, Box2, WaitingButton, Text, Icon} from '../../common-adapters'
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
    <Box2 direction="vertical" fullWidth={true} fullHeight={true} gap="medium" gapStart={true}>
      <Box2 direction="vertical" style={styles.contents} centerChildren={true} gap="medium">
        <Text type={isMobile ? 'Body' : 'Header'}>
          Set a public name for this new {isMobile ? 'phone' : 'computer'}:
        </Text>
        <Icon type={isMobile ? 'icon-phone-64' : 'icon-computer-64'} />
        <Input
          autoFocus={true}
          errorText={props.error}
          hintText="Pick a device name"
          onEnterKeyDown={props.onSubmit}
          onChangeText={props.onChange}
          value={props.deviceName}
        />
        <WaitingButton
          disabled={!props.onSubmit}
          label="Continue"
          onClick={props.onSubmit}
          waitingKey={Constants.waitingKey}
        />
      </Box2>
    </Box2>
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
    maxWidth: isMobile ? undefined : 460,
    width: '100%',
  },
})

export default SetPublicName
