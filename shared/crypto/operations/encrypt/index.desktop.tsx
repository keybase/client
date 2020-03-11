import * as React from 'react'
import * as CryptoGen from '../../../actions/crypto-gen'
import * as Kb from '../../../common-adapters'
import * as Constants from '../../../constants/crypto'
import * as Styles from '../../../styles'
import * as Container from '../../../util/container'
import openURL from '../../../util/open-url'
import {DragAndDrop, Input, OperationBanner} from '../../input'
import OperationOutput, {OutputBar, OutputInfoBanner, SignedSender} from '../../output'
import Recipients from '../../recipients'

const operation = Constants.Operations.Encrypt

const EncryptOptions = () => {
  const dispatch = Container.useDispatch()

  const hideIncludeSelf = Container.useSelector(state => state.crypto.encrypt.meta.hideIncludeSelf)
  const hasRecipients = Container.useSelector(state => state.crypto.encrypt.meta.hasRecipients)
  const hasSBS = Container.useSelector(state => state.crypto.encrypt.meta.hasSBS)
  const includeSelf = Container.useSelector(state => state.crypto.encrypt.options.includeSelf)
  const sign = Container.useSelector(state => state.crypto.encrypt.options.sign)
  const inProgress = Container.useSelector(state => state.crypto.encrypt.inProgress)

  const onSetOptions = (opts: {newIncludeSelf: boolean; newSign: boolean}) => {
    const {newIncludeSelf, newSign} = opts
    dispatch(CryptoGen.createSetEncryptOptions({options: {includeSelf: newIncludeSelf, sign: newSign}}))
  }

  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} gap="medium" style={styles.optionsContainer}>
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
}

const EncryptOutputBanner = () => {
  const includeSelf = Container.useSelector(state => state.crypto.encrypt.options.includeSelf)
  const hasRecipients = Container.useSelector(state => state.crypto.encrypt.meta.hasRecipients)
  const recipients = Container.useSelector(state => state.crypto.encrypt.recipients)
  const outputType = Container.useSelector(state => state.crypto.encrypt.outputType)

  const youAnd = (who: string) => (includeSelf ? `you and ${who}` : who)
  const whoCanRead = hasRecipients
    ? ` Only ${recipients?.length > 1 ? youAnd('your recipients') : youAnd(recipients[0])} can decipher it.`
    : ''

  return (
    <OutputInfoBanner operation={operation}>
      <Kb.BannerParagraph
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
      <Kb.BannerParagraph
        bannerColor="grey"
        content={[hasRecipients ? ' Share it however you like.' : null, whoCanRead]}
      />
    </OutputInfoBanner>
  )
}

export const EncryptInput = () => {
  return (
    <>
      <OperationBanner
        operation={operation}
        infoMessage="Encrypt to anyone, even if they're not on Keybase yet."
      />
      <Recipients />
      <Input operation={operation} />
      <EncryptOptions />
    </>
  )
}

export const EncryptOutput = () => (
  <>
    <EncryptOutputBanner />
    <SignedSender operation={operation} />
    <OperationOutput operation={operation} />
    <OutputBar operation={operation} />
  </>
)

const Encrypt = () => (
  <DragAndDrop operation={operation} prompt="Drop a file to encrypt">
    <Kb.Box2 direction="vertical" fullHeight={true}>
      <EncryptInput />
      <EncryptOutput />
    </Kb.Box2>
  </DragAndDrop>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      optionsContainer: {
        ...Styles.padding(Styles.globalMargins.small, Styles.globalMargins.small),
        alignItems: 'center',
        height: 40,
      },
    } as const)
)

export default Encrypt
