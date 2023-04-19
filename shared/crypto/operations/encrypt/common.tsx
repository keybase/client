import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Constants from '../../../constants/crypto'
import * as Container from '../../../util/container'
import * as CryptoGen from '../../../actions/crypto-gen'
import openURL from '../../../util/open-url'
import {OutputInfoBanner} from '../../output'

const operation = Constants.Operations.Encrypt

export const EncryptOptions = React.memo(function EncryptOptions() {
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

export const EncryptOutputBanner = () => {
  const includeSelf = Container.useSelector(state => state.crypto.encrypt.options.includeSelf)
  const hasRecipients = Container.useSelector(state => state.crypto.encrypt.meta.hasRecipients)
  const recipients = Container.useSelector(state => state.crypto.encrypt.recipients)
  const outputType = Container.useSelector(state => state.crypto.encrypt.outputType)

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
        content={[hasRecipients ? ' Share it however you like.' : null, whoCanRead]}
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
