// @flow
import * as React from 'react'
import * as Constants from '../../constants/provision'
import {BackButton, Box2, Text, Icon, Input, WaitingButton} from '../../common-adapters'
import {styleSheetCreate, isMobile} from '../../styles'

type Props = {
  onBack: () => void,
  onSubmit: () => void,
  onChangePaperKey: (val: string) => void,
  paperKey: string,
  hint: string,
  error: string,
  waitingForResponse?: ?boolean,
}

const PaperKey = (props: Props) => (
  <Box2 direction="vertical" fullWidth={true} fullHeight={true} gap="medium">
    <BackButton onClick={props.onBack} />
    <Box2
      direction="vertical"
      style={styles.contents}
      centerChildren={true}
      gap={isMobile ? 'tiny' : 'medium'}
    >
      <Box2 direction="vertical" gap="tiny" centerChildren={true}>
        <Icon type="icon-paper-key-48" />
        <Text type="BodySemiboldItalic">{props.hint}</Text>
      </Box2>
      <Input
        autoFocus={true}
        multiline={true}
        rowsMax={3}
        style={styles.input}
        errorText={props.error}
        hintText="Type in your paper key"
        onEnterKeyDown={props.onSubmit}
        onChangeText={props.onChangePaperKey}
        value={props.paperKey}
      />
      <WaitingButton
        label="Continue"
        type="Primary"
        onClick={props.onSubmit}
        enabled={!!props.paperKey}
        waitingKey={Constants.waitingKey}
      />
    </Box2>
  </Box2>
)

const styles = styleSheetCreate({
  contents: {
    maxWidth: isMobile ? undefined : 460,
    width: '100%',
  },
})

export default PaperKey
