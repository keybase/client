// @flow
import type {Props} from './confirm-or-pending'

const commonConfirm = (platform: string) => ({
  title: 'Your proof is verified!',
  platformIcon: `icon-${platform}-logo-48`,
  platformIconOverlay: 'iconfont-proof-good',
  usernameSubtitle: `@${platform}`,
  message: 'Leave your proof up so other users can identify you!',
  messageSubtitle: null,
})

export function propsForPlatform (props: Props): Object {
  switch (props.platform) {
    case 'twitter':
      return {
        ...commonConfirm(props.platform),
      }
    case 'reddit':
      return {
        ...commonConfirm(props.platform),
      }
    case 'github':
      return {
        ...commonConfirm(props.platform),
      }
    case 'coinbase':
      return {
        ...commonConfirm(props.platform),
      }
    case 'hackernews':
      return {
        ...commonConfirm(props.platform),
      }
    case 'dns':
      return {
        ...commonConfirm(props.platform),
      }
    case 'btc':
      return {
        ...commonConfirm(props.platform),
        title: 'Verified!',
        platformIcon: `icon-${props.platform}-logo-48`,
        platformIconOverlay: 'iconfont-proof-good',
        usernameSubtitle: null,
        message: 'You Bitcoin address has now been signed onto your profile.',
        messageSubtitle: null,
      }
    case 'http':
      return {
        ...commonConfirm(props.platform),
        messageSubtitle: `Note: ${props.username} doesn't load over https. If you get a real SSL certificate (not self-signed) in the future, please replace this proof with a fresh one.`,
      }
    case 'https':
      return {
        ...commonConfirm(props.platform),
      }
    default:
      return {}
  }
}
