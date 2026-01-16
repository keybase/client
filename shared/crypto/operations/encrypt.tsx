import * as C from '@/constants'
import * as Crypto from '@/stores/crypto'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import Recipients from '../recipients'
import openURL from '@/util/open-url'
import {DragAndDrop, Input, InputActionsBar, OperationBanner} from '../input'
import {OutputInfoBanner, OperationOutput, OutputActionsBar, SignedSender} from '../output'

const operation = Crypto.Operations.Encrypt

const EncryptOptions = React.memo(function EncryptOptions() {
  const {hasSBS, hasRecipients, hideIncludeSelf, includeSelf, inProgress, sign} = Crypto.useCryptoState(
    C.useShallow(s => {
      const o = s[operation]
      const {inProgress} = o
      const {hasRecipients, hideIncludeSelf, hasSBS} = o.meta
      const {includeSelf, sign} = o.options
      return {hasRecipients, hasSBS, hideIncludeSelf, inProgress, includeSelf, sign}
    })
  )

  const setEncryptOptions = Crypto.useCryptoState(s => s.dispatch.setEncryptOptions)

  const onSetOptions = (opts: {newIncludeSelf: boolean; newSign: boolean}) => {
    const {newIncludeSelf, newSign} = opts
    setEncryptOptions({includeSelf: newIncludeSelf, sign: newSign})
  }

  const direction = Kb.Styles.isTablet ? 'horizontal' : Kb.Styles.isMobile ? 'vertical' : 'horizontal'
  const gap = Kb.Styles.isTablet ? 'medium' : Kb.Styles.isMobile ? 'xtiny' : 'medium'

  return (
    <Kb.Box2
      direction={direction}
      fullWidth={true}
      centerChildren={Kb.Styles.isTablet}
      gap={gap}
      style={styles.optionsContainer}
    >
      {hideIncludeSelf ? null : (
        <Kb.Checkbox
          label="Include yourself"
          disabled={inProgress || hasSBS || !hasRecipients}
          checked={hasSBS || includeSelf}
          onCheck={newValue => onSetOptions({newIncludeSelf: newValue, newSign: sign})}
        />
      )}
      <Kb.Checkbox
        label="Sign"
        disabled={inProgress || hasSBS}
        checked={sign}
        onCheck={newValue => onSetOptions({newIncludeSelf: includeSelf, newSign: newValue})}
      />
    </Kb.Box2>
  )
})

const EncryptOutputBanner = () => {
  const {hasRecipients, includeSelf, recipients, outputType} = Crypto.useCryptoState(
    C.useShallow(s => {
      const o = s[operation]
      const {recipients, outputType} = o
      const {hasRecipients} = o.meta
      const {includeSelf} = o.options
      return {hasRecipients, includeSelf, outputType, recipients}
    })
  )

  const youAnd = (who: string) => (includeSelf ? `you and ${who}` : who)
  const whoCanRead = hasRecipients
    ? ` Only ${
        recipients.length > 1 ? youAnd('your recipients') : youAnd(recipients[0] ?? '')
      } can decipher it.`
    : ''

  const paragraphs: Array<React.ReactElement<typeof Kb.BannerParagraph>> = []
  paragraphs.push(
    <Kb.BannerParagraph
      key="saltpackDisclaimer"
      bannerColor="grey"
      content={[
        `This is your encrypted ${outputType === 'file' ? 'file' : 'message'}, using `,
        {
          onClick: () => openURL(Crypto.saltpackDocumentation),
          text: 'Saltpack',
        },
        '.',
        outputType === 'text' ? " It's also called ciphertext." : '',
      ]}
    />
  )
  if (hasRecipients) {
    paragraphs.push(
      <Kb.BannerParagraph
        key="whoCanRead"
        bannerColor="grey"
        content={[' Share it however you like.', whoCanRead]}
      />
    )
  }

  return <OutputInfoBanner operation={operation}>{paragraphs}</OutputInfoBanner>
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      optionsContainer: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.padding(Kb.Styles.globalMargins.small, Kb.Styles.globalMargins.small),
          alignItems: 'center',
          height: 40,
        },
        isMobile: {
          alignItems: 'flex-start',
        },
        isTablet: {
          ...Kb.Styles.globalStyles.fullWidth,
          alignSelf: 'center',
          justifyContent: 'space-between',
          maxWidth: 460,
        },
      }),
    }) as const
)

export const EncryptInput = () => {
  const blurCBRef = React.useRef(() => {})
  const setBlurCB = React.useCallback((cb: () => void) => {
    blurCBRef.current = cb
  }, [])

  const options = C.isMobile ? (
    <InputActionsBar operation={operation} blurCBRef={blurCBRef}>
      <EncryptOptions />
    </InputActionsBar>
  ) : (
    <EncryptOptions />
  )
  const content = (
    <>
      <OperationBanner operation={operation} />
      <Recipients />
      <Input operation={operation} setBlurCB={setBlurCB} />
      {options}
    </>
  )

  const resetOperation = Crypto.useCryptoState(s => s.dispatch.resetOperation)
  React.useEffect(() => {
    return () => {
      if (C.isMobile) {
        resetOperation(operation)
      }
    }
  }, [resetOperation])
  return C.isMobile ? (
    <Kb.KeyboardAvoidingView2>{content}</Kb.KeyboardAvoidingView2>
  ) : (
    <Kb.Box2 direction="vertical" fullHeight={true} style={Crypto.inputDesktopMaxHeight}>
      {content}
    </Kb.Box2>
  )
}

export const EncryptOutput = () => (
  <Kb.Box2
    direction="vertical"
    fullHeight={true}
    style={C.isMobile ? undefined : Crypto.outputDesktopMaxHeight}
  >
    <EncryptOutputBanner />
    <SignedSender operation={operation} />
    {C.isMobile ? <Kb.Divider /> : null}
    <OperationOutput operation={operation} />
    <OutputActionsBar operation={operation} />
  </Kb.Box2>
)

export const EncryptIO = () => (
  <DragAndDrop operation={operation} prompt="Drop a file to encrypt">
    <Kb.Box2 direction="vertical" fullHeight={true}>
      <EncryptInput />
      <EncryptOutput />
    </Kb.Box2>
  </DragAndDrop>
)
