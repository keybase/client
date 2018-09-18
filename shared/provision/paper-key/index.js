// @flow
import * as React from 'react'
import * as Constants from '../../constants/provision'
import {ButtonBar, BackButton, Icon, Box2, Text, PlainInput, WaitingButton} from '../../common-adapters'
import {
  globalColors,
  globalMargins,
  globalStyles,
  styleSheetCreate,
  isMobile,
  isAndroid,
  platformStyles,
} from '../../styles'

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
    <BackButton onClick={props.onBack} style={styles.backButton} />
    <Box2
      direction="vertical"
      style={styles.contents}
      centerChildren={!isAndroid /* android keyboardAvoiding doesnt work well */}
      gap={isMobile ? 'tiny' : 'medium'}
    >
      <Box2 direction="vertical" gap="tiny" centerChildren={true} gapEnd={true}>
        <Icon type="icon-paper-key-48" />
        <Text type="Header" style={styles.hint}>
          {props.hint}
        </Text>
      </Box2>
      <Box2 direction="vertical" style={styles.inputContainer}>
        <PlainInput
          autoFocus={true}
          multiline={true}
          rowsMax={3}
          placeholder="Type in your paper key"
          textType="Header"
          style={styles.input}
          onEnterKeyDown={props.onSubmit}
          onChangeText={props.onChangePaperKey}
          value={props.paperKey}
        />
      </Box2>
      {!!props.error && <Text type="BodySmallError">{props.error}</Text>}
      <ButtonBar fullWidth={true}>
        <WaitingButton
          label="Continue"
          type="Primary"
          fullWidth={true}
          onClick={props.onSubmit}
          enabled={!!props.paperKey}
          waitingKey={Constants.waitingKey}
        />
      </ButtonBar>
    </Box2>
  </Box2>
)

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
    flexGrow: 1,
    maxWidth: isMobile ? 300 : 460,
    width: '100%',
  },
  hint: {
    ...globalStyles.italic,
  },
  input: {
    color: globalColors.black,
    ...globalStyles.fontTerminal,
  },
  inputContainer: {
    borderColor: globalColors.black_10,
    borderRadius: 4,
    borderStyle: 'solid',
    borderWidth: 1,
    minHeight: 77,
    padding: globalMargins.small,
    width: '100%',
  },
})

export default PaperKey
