// @flow
import * as React from 'react'
import {Text, Box2, Icon, HeaderHocHeader} from '../../../common-adapters'
import {styleSheetCreate} from '../../../styles'

type Props = {|
  onBack: () => void,
|}

class UsernameAndEmail extends React.Component<Props> {
  render() {
    return (
      <Box2 direction="vertical" fullWidth={true} fullHeight={true}>
        <HeaderHocHeader onBack={this.props.onBack} headerStyle={styles.header} />
        <Box2 direction="vertical" fullWidth={true} fullHeight={true} centerChildren={true} gap="small">
          <Icon type="icon-invite-code-48" />
          <Text type="Header">Invite request sent</Text>
          <Text type="Body">
            Thanks for requesting an invite to Keybase. When one becomes available, we will send it to you via
            email.
          </Text>
        </Box2>
      </Box2>
    )
  }
}

const styles = styleSheetCreate({
  header: {position: 'absolute'},
})

export default UsernameAndEmail
