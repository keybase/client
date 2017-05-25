// @flow
import type {Props} from './confirm-or-pending'

const commonConfirm = ({platform, isPending}) => ({
  title: isPending ? 'Your proof is pending.' : 'Verified!',
  platformIcon: `icon-${platform}-logo-48`,
  platformIconOverlay: isPending ? 'icon-proof-pending' : 'icon-proof-success',
  usernameSubtitle: `@${platform}`,
  message: isPending
    ? 'Some proofs can take a few hours to recognize. Check back later.'
    : 'Leave your proof up so other users can identify you!',
  messageSubtitle: null,
})

export function propsForPlatform(props: Props): Object {
  switch (props.platform) {
    case 'twitter':
      return {
        ...commonConfirm(props),
      }
    case 'facebook':
      return {
        ...commonConfirm(props),
      }
    case 'reddit':
      return {
        ...commonConfirm(props),
      }
    case 'github':
      return {
        ...commonConfirm(props),
      }
    case 'hackernews':
      return {
        ...commonConfirm(props),
        message: props.isPending
          ? 'Hacker News caches its bios, so it might be a few hours before you can verify your proof. Check back later.'
          : 'Leave your proof up so other users can identify you!',
      }
    case 'dns':
      return {
        ...commonConfirm(props),
        message: props.isPending
          ? 'DNS proofs can take a few hours to recognize. Check back later.'
          : 'Leave your proof up so other users can identify you!',
      }
    case 'zcash':
      return {
        ...commonConfirm(props),
        title: 'Verified!',
        platformIcon: `icon-${props.platform}-logo-48`,
        platformIconOverlay: 'icon-proof-success',
        usernameSubtitle: null,
        message: 'You Zcash address has now been signed onto your profile.',
        messageSubtitle: null,
      }
    case 'btc':
      return {
        ...commonConfirm(props),
        title: 'Verified!',
        platformIcon: `icon-${props.platform}-logo-48`,
        platformIconOverlay: 'icon-proof-success',
        usernameSubtitle: null,
        message: 'You Bitcoin address has now been signed onto your profile.',
        messageSubtitle: null,
      }
    case 'http':
      return {
        ...commonConfirm(props),
        messageSubtitle: `Note: ${props.username} doesn't load over https. If you get a real SSL certificate (not self-signed) in the future, please replace this proof with a fresh one.`,
      }
    case 'https':
      return {
        ...commonConfirm(props),
      }
    default:
      return {}
  }
}
