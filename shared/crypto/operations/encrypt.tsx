import * as Constants from '../../constants/crypto'
import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import * as React from 'react'
import * as Styles from '../../styles'
import Recipients from '../recipients'
import openURL from '../../util/open-url'
import {DragAndDrop, InputActionsBar, OperationBanner, FileInput, TextInput} from '../input'
import {OutputInfoBanner, OperationOutput, OutputActionsBar, SignedSender} from '../output'
import shallowEqual from 'shallowequal'

const operation = Constants.Operations.Encrypt

const EncryptOptions = React.memo(function EncryptOptions() {
  const hideIncludeSelf = Constants.useEncryptState(s => s.hideIncludeSelf)
  const hasRecipients = Constants.useEncryptState(s => s.recipients.length > 0)
  const hasSBS = Constants.useEncryptState(s => s.hasSBS)
  const includeSelf = Constants.useEncryptState(s => s.includeSelf)
  const sign = Constants.useEncryptState(s => s.sign)
  const inProgress = Constants.useEncryptState(s => s.inProgress)
  const setOptions = Constants.useEncryptState(s => s.dispatch.setOptions)

  const direction = Styles.isTablet ? 'horizontal' : Styles.isMobile ? 'vertical' : 'horizontal'
  const gap = Styles.isTablet ? 'medium' : Styles.isMobile ? 'xtiny' : 'medium'

  return (
    <Kb.Box2
      direction={direction}
      fullWidth={true}
      centerChildren={Styles.isTablet}
      gap={gap}
      style={styles.optionsContainer}
    >
      {hideIncludeSelf ? null : (
        <Kb.Checkbox
          label="Include yourself"
          disabled={inProgress || hasSBS || !hasRecipients}
          checked={hasSBS || includeSelf}
          onCheck={newValue => setOptions(newValue, sign, hideIncludeSelf)}
        />
      )}
      <Kb.Checkbox
        label="Sign"
        disabled={inProgress || hasSBS}
        checked={sign}
        onCheck={newValue => setOptions(includeSelf, newValue, hideIncludeSelf)}
      />
    </Kb.Box2>
  )
})

const EncryptOutputBanner = () => {
  const includeSelf = Constants.useEncryptState(s => s.includeSelf)
  const hasRecipients = Constants.useEncryptState(s => s.recipients.length > 0)
  const recipients = Constants.useEncryptState(s => s.recipients)
  const outputType = Constants.useEncryptState(s => s.inputType())

  const youAnd = (who: string) => (includeSelf ? `you and ${who}` : who)
  const whoCanRead = hasRecipients
    ? ` Only ${recipients?.length > 1 ? youAnd('your recipients') : youAnd(recipients[0])} can decipher it.`
    : ''

  const paragraphs: Array<React.ReactElement<typeof Kb.BannerParagraph>> = []
  paragraphs.push(
    <Kb.BannerParagraph
      key="saltpackDisclaimer"
      bannerColor="grey"
      content={[
        `This is your encrypted ${outputType === 'file' ? 'file' : 'message'}, using `,
        {
          onClick: () => openURL(Constants.saltpackDocumentation),
          text: 'Saltpack',
        },
        '.',
        outputType == 'text' ? " It's also called ciphertext." : '',
      ]}
    />
  )
  if (hasRecipients) {
    paragraphs.push(
      <Kb.BannerParagraph
        key="whoCanRead"
        bannerColor="grey"
        content={[hasRecipients ? ' Share it however you like.' : undefined, whoCanRead]}
      />
    )
  }

  return <OutputInfoBanner operation={operation}>{paragraphs}</OutputInfoBanner>
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      optionsContainer: Styles.platformStyles({
        isElectron: {
          ...Styles.padding(Styles.globalMargins.small, Styles.globalMargins.small),
          alignItems: 'center',
          height: 40,
        },
        isMobile: {
          alignItems: 'flex-start',
        },
        isTablet: {
          ...Styles.globalStyles.fullWidth,
          alignSelf: 'center',
          justifyContent: 'space-between',
          maxWidth: 460,
        },
      }),
    } as const)
)

export const EncryptInput = () => {
  const {text, file, inProgress, warningMessage, errorMessage, output, outputValid, inputType} =
    Constants.useEncryptState(s => {
      const {text, file, inProgress, warningMessage, errorMessage, output, outputValid} = s
      return {
        errorMessage,
        file,
        inProgress,
        inputType: s.inputType(),
        isSuccessful: s.outputStatus === 'success',
        output,
        outputValid,
        text,
        warningMessage,
      }
    }, shallowEqual)
  const setText = Constants.useEncryptState(s => s.dispatch.setText)
  const setFile = Constants.useEncryptState(s => s.dispatch.setFile)
  const size = 0
  const onClearFiles = () => {
    setFile('')
  }

  const input =
    inputType === 'text' ? (
      <TextInput
        onChangeText={setText}
        onSetFile={setFile}
        value={text}
        textIsCipher={false}
        placeholder={Container.isMobile ? 'Enter text to encrypt' : 'Enter text, drop a file or folder, or'}
        emptyWidth={207}
      />
    ) : (
      <FileInput path={file} size={size} onClearFiles={onClearFiles} fileIcon="icon-file-64" />
    )
  const options = Container.isMobile ? (
    <InputActionsBar>
      <EncryptOptions />
    </InputActionsBar>
  ) : (
    <EncryptOptions />
  )
  const content = (
    <>
      <OperationBanner
        infoMessage={Constants.infoMessage.encrypt}
        warningMessage={warningMessage}
        errorMessage={errorMessage}
      />
      <Recipients />
      {input}
      {options}
    </>
  )

  const reset = Constants.useEncryptState(s => s.dispatch.reset)
  React.useEffect(() => {
    return () => {
      if (Container.isMobile) {
        reset()
      }
    }
  }, [reset])
  return Container.isMobile ? (
    <Kb.KeyboardAvoidingView2>{content}</Kb.KeyboardAvoidingView2>
  ) : (
    <Kb.Box2 direction="vertical" fullHeight={true} style={Constants.inputDesktopMaxHeight}>
      {content}
    </Kb.Box2>
  )
}

export const EncryptOutput = () => {
  const {text, file, inProgress, warningMessage, errorMessage, output, outputValid, inputType, isSuccessful} =
    Constants.useEncryptState(s => {
      const {text, file, inProgress, warningMessage, errorMessage, output, outputValid} = s
      return {
        errorMessage,
        file,
        inProgress,
        inputType: s.inputType(),
        isSuccessful: s.outputStatus === 'success',
        output,
        outputValid,
        text,
        warningMessage,
      }
    }, shallowEqual)
  const content = (
    <>
      <EncryptOutputBanner />
      <SignedSender operation={operation} />
      {Container.isMobile ? <Kb.Divider /> : null}
      <OperationOutput
        textType={'cipher'}
        inProgress={inProgress}
        output={output}
        outputValid={outputValid}
        outputType={inputType}
        isSuccessful={isSuccessful}
        outputTextIsLarge={}
        fileIcon={}
      />
      <OutputActionsBar operation={operation} />
    </>
  )

  return Container.isMobile ? (
    content
  ) : (
    <Kb.Box2 direction="vertical" fullHeight={true} style={Constants.outputDesktopMaxHeight}>
      {content}
    </Kb.Box2>
  )
}

export const EncryptIO = () => {
  const inProgress = Constants.useEncryptState(s => s.inProgress)
  const setFile = Constants.useEncryptState(s => s.dispatch.setFile)
  return (
    <DragAndDrop
      prompt="Drop a file to encrypt"
      allowFolders={true}
      inProgress={inProgress}
      setFile={setFile}
    >
      <Kb.Box2 direction="vertical" fullHeight={true}>
        <EncryptInput />
        <EncryptOutput />
      </Kb.Box2>
    </DragAndDrop>
  )
}

export default EncryptInput
