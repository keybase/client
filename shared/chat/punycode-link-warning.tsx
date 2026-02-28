import * as Kb from '@/common-adapters'
import {useSafeNavigation} from '@/util/safe-navigation'
import openURL from '@/util/open-url'

type PunycodeLinkWarningProps = {
  display: string
  punycode: string
  url: string
}

const PunycodeLinkWarning = (props: PunycodeLinkWarningProps) => {
  const {url, display, punycode} = props
  const nav = useSafeNavigation()
  const onCancel = () => nav.safeNavigateUp()
  const onConfirm = () => {
    openURL(url)
    nav.safeNavigateUp()
  }
  const description = `The link you clicked on appears to be ${display}, but actually points to ${punycode}.`
  return (
    <Kb.ConfirmModal
      icon="iconfont-open-browser"
      iconColor={Kb.Styles.globalColors.red}
      prompt={'Open URL?'}
      description={description}
      onCancel={onCancel}
      onConfirm={onConfirm}
      confirmText="Yes, open in browser"
    />
  )
}

export default PunycodeLinkWarning
