// @flow
import * as React from 'react'
import * as Constants from '../../../constants/signup'
import {Text, Box2, WaitingButton, HeaderHocHeader} from '../../../common-adapters'
import {styleSheetCreate} from '../../../styles'

type Props = {|
  error: string,
  onBack: () => void,
|}

class UsernameAndEmail extends React.Component<Props> {
  render() {
    return (
      <Box2 direction="vertical" fullWidth={true} fullHeight={true}>
        <HeaderHocHeader onBack={this.props.onBack} headerStyle={styles.header} />
        <Box2 direction="vertical" fullWidth={true} fullHeight={true} centerChildren={true} gap="small">
          <Text type="Header">Ah Shoot! Something went wrong, wanna try again?</Text>
          <Text type="BodyError">{this.props.error}</Text>
          <WaitingButton
            waitingKey={Constants.waitingKey}
            type="Primary"
            label="Try again"
            onClick={this.props.onBack}
          />
        </Box2>
      </Box2>
    )
  }
}

const styles = styleSheetCreate({
  header: {position: 'absolute'},
})

export default UsernameAndEmail
