// @flow
import * as Constants from '../../constants/provision'
import * as React from 'react'
import {Input, BackButton, Box2, WaitingButton, Text, Icon} from '../../common-adapters'
import {styleSheetCreate, isMobile} from '../../styles'

type Props = {|
  onBack: () => void,
  onChange: (deviceName: string) => void,
  onSubmit: null | (() => void),
  deviceName: string,
  error: string,
|}

const SetPublicName = (props: Props) => {
  return (
    <Box2 direction="vertical" fullWidth={true} fullHeight={true} gap="medium">
      <BackButton onClick={props.onBack} style={styles.backButton} />
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
          type="Primary"
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
  contents: {
    maxWidth: isMobile ? undefined : 460,
    width: '100%',
  },
  icon: {
    alignSelf: 'center',
  },
})

export default SetPublicName
