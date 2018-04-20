// @noflow
// TODO port
// import ConfirmOrPending from './confirm-or-pending'
// import EditAvatar from './edit-avatar'
// import PostProof from './post-proof'
// import ProveEnterUsername from './prove-enter-username'
// import ProveWebsiteChoice from './prove-website-choice'
// import Revoke from './revoke'
// import pgpDumb from './pgp/dumb'
// import editProfileDumb from './edit-profile/dumb'
// import {globalColors, isMobile} from '../styles'
// import type {DumbComponentMap} from '../constants/types/more'

// const confirmBase = {
// platform: 'twitter',
// title: 'Verified!',
// titleColor: globalColors.green,
// platformIcon: 'icon-twitter-logo-48',
// platformIconOverlay: 'icon-proof-success',
// platformIconOverlayColor: globalColors.green,
// isPending: false,
// username: 'chris',
// usernameSubtitle: '@twitter',
// message: 'Leave your proof up so other users can identify you!',
// onReloadProfile: () => {
// console.log('on reload profile')
// },
// }

// const pending = {
// isPending: true,
// titleText: 'Your proof is pending.',
// platformIconOverlay: 'icon-proof-pending',
// platformIconOverlayColor: globalColors.grey,
// titleColor: globalColors.blue,
// }

// const dumbConfirmOrPendingMap: DumbComponentMap<ConfirmOrPending> = {
// component: ConfirmOrPending,
// mocks: {
// 'Confirm Twitter': confirmBase,
// 'Confirm Reddit': {...confirmBase, platform: 'reddit'},
// 'Confirm Facebook': {...confirmBase, platform: 'facebook'},
// 'Confirm GitHub': {...confirmBase, platform: 'github'},
// 'Pending Hacker News': {
// ...confirmBase,
// ...pending,
// platform: 'hackernews',
// message:
// 'Hacker News caches its bios, so it might be a few hours before you can verify your proof. Check back later.',
// },
// 'Confirm Bitcoin': {
// ...confirmBase,
// platform: 'btc',
// usernameSubtitle: undefined,
// message: 'Your Bitcoin address has now been signed onto your profile.',
// title: 'Verified',
// },
// 'Confirm zcash': {
// ...confirmBase,
// platform: 'zcash',
// usernameSubtitle: undefined,
// message: 'Your Zcash address has now been signed onto your profile.',
// title: 'Verified',
// },
// 'Pending dns': {
// ...confirmBase,
// ...pending,
// platform: 'dns',
// usernameSubtitle: 'dns',
// message: 'DNS proofs can take a few hours to recognize. Check back later.',
// },
// 'Confirm http': {
// ...confirmBase,
// platform: 'http',
// usernameSubtitle: 'http',
// message: 'Leave your proof up so other users can identify you!',
// messageSubtitle:
// "Note: www.chriscoyne.com doesn't load over https. If you get a real SSL certificate (not self-signed) in the future, please replace this proof with a fresh one.",
// },
// },
// }

// const proveEnterUsernameBase = {
// username: 'chris',
// errorText: null,
// errorCode: null,
// canContinue: true,
// onUsernameChange: username => {
// console.log('username change', username)
// },
// onContinue: () => {
// console.log('continue clicked')
// },
// onCancel: () => {
// console.log('cancel clicked')
// },
// parentProps: isMobile ? {} : {style: {display: 'flex', minWidth: 640, height: 580}},
// }

// const dumbProveEnterUsername: DumbComponentMap<ProveEnterUsername> = {
// component: ProveEnterUsername,
// mocks: {
// Twitter: {...proveEnterUsernameBase, platform: 'twitter'},
// 'Twitter with Error': {...proveEnterUsernameBase, platform: 'twitter', errorText: 'Something went wrong'},
// Reddit: {...proveEnterUsernameBase, platform: 'reddit'},
// Facebook: {...proveEnterUsernameBase, platform: 'facebook'},
// GitHub: {...proveEnterUsernameBase, platform: 'github'},
// 'Hacker News': {...proveEnterUsernameBase, platform: 'hackernews'},
// Bitcoin: {...proveEnterUsernameBase, platform: 'btc'},
// 'Bitcoin - Disabled': {...proveEnterUsernameBase, platform: 'btc', canContinue: false},
// DNS: {...proveEnterUsernameBase, platform: 'dns'},
// Website: {...proveEnterUsernameBase, platform: 'http'},
// Zcash: {...proveEnterUsernameBase, platform: 'zcash'},
// },
// }

// const editAvatarBase = {
// keybaseUsername: 'thedude',
// hasAvatar: true,
// onAck: () => console.log('clicked onAck'),
// }

// const dumbEditAvatar: DumbComponentMap<EditAvatar> = {
// component: EditAvatar,
// mocks: {
// 'has avatar': {...editAvatarBase},
// 'does not have avatar': {...editAvatarBase, hasAvatar: false},
// },
// }

// const revokeBase = {
// onCancel: () => console.log('Revoke Proof: clicked Cancel'),
// onRevoke: () => console.log('Revoke Proof: clicked Revoke'),
// }

// const revokeTwitter = {
// ...revokeBase,
// platformHandle: 'alexrwendland',
// platform: 'twitter',
// }

// const dumbRevoke: DumbComponentMap<Revoke> = {
// component: Revoke,
// mocks: {
// Twitter: {...revokeTwitter},
// 'Twitter - Error': {
// ...revokeTwitter,
// errorMessage: 'There was an error revoking your proof. You can click the button to try again.',
// },
// 'Twitter - Waiting': {...revokeTwitter, isWaiting: true},
// Reddit: {...revokeBase, platformHandle: 'malgorithms', platform: 'reddit'},
// Facebook: {...revokeBase, platformHandle: 'malgorithms', platform: 'facebook'},
// GitHub: {...revokeBase, platformHandle: 'malgorithms', platform: 'github'},
// 'Hacker News': {...revokeBase, platformHandle: 'malgorithms', platform: 'hackernews'},
// Bitcoin: {...revokeBase, platformHandle: '1BjgMvwVkpmmJ5HFGZ3L3H1G6fcKLNGT5h', platform: 'btc'},
// DNS: {...revokeBase, platformHandle: 'chriscoyne.com', platform: 'dns'},
// Website: {...revokeBase, platformHandle: 'chriscoyne.com', platform: 'http'},
// 'https website': {...revokeBase, platformHandle: 'chriscoyne.com', platform: 'https'},
// Zcash: {...revokeBase, platformHandle: '1234-fake', platform: 'zcash'},
// },
// }

// const postProofBase = {
// allowProofCheck: true,
// platformUserName: 'awendland',
// onCancelText: 'Cancel',
// onCancel: () => {
// console.log('PostProof: onCancel clicked')
// },
// onAllowProofCheck: () => {
// console.log('PostProof: onAllowProofCheck clicked')
// },
// onComplete: () => {
// console.log('PostProof: onComplete clicked')
// },
// parentProps: isMobile ? {} : {style: {display: 'flex', minWidth: 640, height: 580}},
// }

// const postProofTwitter = {
// ...postProofBase,
// platform: 'twitter',
// platformUserName: 'alexrwendland',
// proofText:
// 'Verifying myself: I am awendland on Keybase.io. 3EF5fSCRVw1UZpjzLgDQ5IAxIVpf6XfHuRAB / https://keybase.io/awendland/sigs/3EF5fSCRVw1UZpjzLgDQ5IAxIVpf6XfHuRAB',
// proofAction: () => console.log('Open twitter to post tweet'),
// }

// const dumbPostProof: DumbComponentMap<PostProof> = {
// component: PostProof,
// mocks: {
// Twitter: postProofTwitter,
// 'Twitter Waiting': {
// ...postProofTwitter,
// isOnCompleteWaiting: true,
// },
// 'Twitter Error': {
// ...postProofTwitter,
// errorMessage: "We couldn't find your proof. Please retry!",
// },
// Reddit: {
// ...postProofBase,
// platform: 'reddit',
// proofAction: () => console.log('Open Reddit to post'),
// },
// Facebook: {
// ...postProofBase,
// platform: 'facebook',
// proofAction: () => console.log('Open Facebook to post'),
// },
// GitHub: {
// ...postProofBase,
// platform: 'github',
// // Place a full proof message here in order to test how the UI handles overflow
// proofText:
// '### Keybase proof\n\nI hereby claim:\n\n  * I am chris on github.\n  * I am cboss123 (https://keybase.io/cboss123) on keybase.\n  * I have a public key whose fingerprint is B457 EF35 8730 2603 CEFF  F736 A8F5 0B84 538B 481C\n\nTo claim this, I am signing this object:\n\n```json\n{\n    "body": {\n        "key": {\n            "eldest_kid": "0101099377094ad34d1ef62c6a4a186c0ca02c259b2fdc1cf52b5773baa4aa239d780a",\n            "fingerprint": "b457ef3587302603cefff736a8f50b84538b481c",\n            "host": "keybase.io",\n            "key_id": "a8f50b84538b481c",\n            "kid": "0101099377094ad34d1ef62c6a4a186c0ca02c259b2fdc1cf52b5773baa4aa239d780a",\n            "uid": "b301e0ff41ef623a28220d2c4f074919",\n            "username": "cboss123"\n        },\n        "service": {\n            "name": "github",\n            "username": "cbostrander"\n        },\n        "type": "web_service_binding",\n        "version": 1\n    },\n    "ctime": 1466184805,\n    "expire_in": 157680000,\n    "prev": "b6c111ed28a297f465ca3dcd46cdbd3f64d208d81ed89388675b9e9740d9d7e3",\n    "seqno": 28,\n    "tag": "signature"\n}\n```\n\nwith the key [B457 EF35 8730 2603 CEFF  F736 A8F5 0B84 538B 481C](https://keybase.io/cboss123), yielding the signature:\n\n```\n-----BEGIN PGP MESSAGE-----\nVersion: Keybase OpenPGP v2.0.53\nComment: https://keybase.io/crypto\n\nyMIdAnicrZJbSBVBGMfXskxJisAuiA8t9mIn2529zZ4KKhFNipIuRlmH2ZnZ42rt\nOe7usaJOkBYJ0U0jiuwGRoUPoT6U9FCavuQluthNzIJ8SIqkwiyTmpV6qsdmHob5\n5vf/8/8+pj11MpeS0HtsbUclWcsldLbWxrgiItO9vBEhe/jgXr6MThx0B6GuFyqz\nCB/kBZFtXZc0TdBlRCSZiNRUAVaRjESoYgEjAWCg6AYwCRaxqQBD0TTJQAxAQNKJ\nBgXEB3jTssPUiTqW7TFbQ1Y0akoK1CQBqIKEqWmamqQiaCqCAWVFgoYMRcyEJRHX\nV7BwBnJpthVhNXYJTcT7B/+fc8cm7AxJEKlgmvKEi4QABEAgAMumoMm6qPugSx0b\n7aSMxkbEdUUg8fEAz6oVFqb+YH+/hi2vJGb8rfAcZBPq+CJvT9Sv7qJG6Lc+ZFg2\nYSNksgrquFbE5oMiI7Fn+QairKoilKGgBHi6O2o5NGT5hKKpUGArwEcdWuE3omJR\nFCkBEAFdM2VVwUgimMgqJgaRTFUmQIAEMgTqEoSqphg61TVZIGwkVOL9jsrtCB8E\nkOVEYebpWmEbeTGH8vG2u8WJXEIKN3XKJP9vcSnJM//8uFPJSeNpJ4us8ZH6ysiJ\nV9HNtbmdX0q7l10d+zT7+UBD+vnq3uWJ8xY1dQerugv3n533rG/4Rpicrp/RyHEZ\nmU05F/vPHQwkDT7sf/GyretjSf/2/Deriqc1pItWVZKdNxhvyR9uKCyfu8U4kZd8\n6XJX+eMLLfVewUDd+Hs0K7c5sab6Q50XzWwsehrtSW0duZO4DgzFF4xmLoxlPM56\nJFZmZOZOmzN/n5LzDVfH83uuzXlF8rLat3odwXel994uPfTg6PrjnSsbam8/acaH\nP4+eORIYbc7LvrVC2fDj0z5v8RX3+ra0ovvTXw+tPt2KuY2DYydrOhOWOGsWbjow\nkr6jr+Dnza/fa38ByARBcQ==\n=qsWl\n-----END PGP MESSAGE-----\n\n```\n\nAnd finally, I am proving ownership of the github account by posting this as a gist.\n\n### My publicly-auditable identity:\n\nhttps://keybase.io/cboss123\n\n### From the command line:\n\nConsider the [keybase command line program](https://keybase.io/download).\n\n```bash\n# look me up\nkeybase id cboss123\n```',
// proofAction: () => console.log('Open gist'),
// },
// 'Hacker News': {
// ...postProofBase,
// platform: 'hackernews',
// proofText:
// '[ my public key: https://keybase.io/awendland; my proof: https://keybase.io/awendland/sigs/akwCq7rlMfq_09mUM911_SYMb018w_jYj22RbZQ2oLQ ]',
// proofAction: () => console.log('Open Hacker News'),
// },
// DNS: {
// ...postProofBase,
// platform: 'dns',
// platformUserName: 'alexwendland.com',
// proofText: 'keybase-site-verification=EgqpSziQnyApGkOO-Ylm_lJtDIQC7pi9u_xwgYppdTo',
// },
// HTTP: {
// ...postProofBase,
// platform: 'http',
// platformUserName: 'alexwendland.com',
// proofText:
// '==================================================================\nhttps://keybase.io/awendland\n--------------------------------------------------------------------\n\nI hereby claim:\n\n  * I am an admin of http://www.caleyostrander.com\n  * I am cboss123 (https://keybase.io/cboss123) on keybase.',
// baseUrl: 'http://alexwendland.com',
// },
// },
// }

// const dumbProveWebsiteChoice: DumbComponentMap<ProveWebsiteChoice> = {
// component: ProveWebsiteChoice,
// mocks: {
// 'DNS or File': {
// onCancel: () => console.log('ProveWebsiteChoice: onCancel'),
// onOptionClick: op => console.log(`ProveWebsiteChoice: onOptionClick = ${op}`),
// },
// },
// }

// export default {
// 'Edit Avatar': dumbEditAvatar,
// 'Revoke Proof': dumbRevoke,
// 'New Proof: Confirm or Pending': dumbConfirmOrPendingMap,
// 'New Proof: Enter Username': dumbProveEnterUsername,
// 'New Proof: Post': dumbPostProof,
// 'New Proof: Website': dumbProveWebsiteChoice,
// ...pgpDumb,
// ...editProfileDumb,
// }
