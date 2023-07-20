import * as Kb from '../common-adapters'
import * as Container from '../util/container'
import * as Styles from '../styles'
import openURL from '../util/open-url'

type PunycodeLinkWarningProps = {
  display: string
  punycode: string
  url: string
}

const PunycodeLinkWarning = (props: PunycodeLinkWarningProps) => {
  const {url, display, punycode} = props
  const nav = Container.useSafeNavigation()
  const onCancel = () => nav.safeNavigateUp()
  const onConfirm = () => {
    openURL(url)
    nav.safeNavigateUp()
  }
  const description = `The link you clicked on appears to be ${display}, but actually points to ${punycode}.`
  return (
    <Kb.ConfirmModal
      icon="iconfont-open-browser"
      iconColor={Styles.globalColors.red}
      prompt={'Open URL?'}
      description={description}
      onCancel={onCancel}
      onConfirm={onConfirm}
      confirmText="Yes, open in browser"
    />
  )
}

export default PunycodeLinkWarning
