import * as React from 'react'
import {Box} from '../../common-adapters'
import {action, storiesOf} from '../../stories/storybook'
import * as Styles from '../../styles'
import Render from '.'

const props = {
  copyToClipboard: action('copyToClipboard'),
  errorMessage: '',
  onCancel: action('onCancel'),
  onSubmit: action('onSubmit'),
  openLinkBeforeSubmit: true,
  platformUserName: 'awendland',
  url: 'a url',
}

const propsTwitter = {
  ...props,
  platform: 'twitter',
  platformUserName: 'alexrwendland',
  proofText:
    'Verifying myself: I am awendland on Keybase.io. 3EF5fSCRVw1UZpjzLgDQ5IAxIVpf6XfHuRAB / https://keybase.io/awendland/sigs/3EF5fSCRVw1UZpjzLgDQ5IAxIVpf6XfHuRAB',
}

const PostProof = props => (
  <Box style={{display: 'flex', height: 580, minWidth: Styles.isMobile ? undefined : 640}}>
    <Render {...props} />
  </Box>
)

const load = () => {
  storiesOf('Profile/PostProof', module)
    .add('Twitter', () => <PostProof {...propsTwitter} />)
    .add('Twitter Waiting', () => <PostProof {...propsTwitter} isOnCompleteWaiting={true} />)
    .add('Twitter Error', () => (
      <PostProof {...propsTwitter} errorMessage={"We couldn't find your proof. Please retry!"} />
    ))
    .add('Reddit', () => <PostProof {...props} platform={'reddit'} />)
    .add('GitHub', () => (
      <PostProof
        {...props}
        platform={'github'}
        proofText={
          '### Keybase proof\n\nI hereby claim:\n\n  * I am chris on github.\n  * I am cboss123 (https://keybase.io/cboss123) on keybase.\n  * I have a public key whose fingerprint is B457 EF35 8730 2603 CEFF  F736 A8F5 0B84 538B 481C\n\nTo claim this, I am signing this object:\n\n```json\n{\n    "body": {\n        "key": {\n            "eldest_kid": "0101099377094ad34d1ef62c6a4a186c0ca02c259b2fdc1cf52b5773baa4aa239d780a",\n            "fingerprint": "b457ef3587302603cefff736a8f50b84538b481c",\n            "host": "keybase.io",\n            "key_id": "a8f50b84538b481c",\n            "kid": "0101099377094ad34d1ef62c6a4a186c0ca02c259b2fdc1cf52b5773baa4aa239d780a",\n            "uid": "b301e0ff41ef623a28220d2c4f074919",\n            "username": "cboss123"\n        },\n        "service": {\n            "name": "github",\n            "username": "cbostrander"\n        },\n        "type": "web_service_binding",\n        "version": 1\n    },\n    "ctime": 1466184805,\n    "expire_in": 157680000,\n    "prev": "b6c111ed28a297f465ca3dcd46cdbd3f64d208d81ed89388675b9e9740d9d7e3",\n    "seqno": 28,\n    "tag": "signature"\n}\n```\n\nwith the key [B457 EF35 8730 2603 CEFF  F736 A8F5 0B84 538B 481C](https://keybase.io/cboss123), yielding the signature:\n\n```\n-----BEGIN PGP MESSAGE-----\nVersion: Keybase OpenPGP v2.0.53\nComment: https://keybase.io/crypto\n\nyMIdAnicrZJbSBVBGMfXskxJisAuiA8t9mIn2529zZ4KKhFNipIuRlmH2ZnZ42rt\nOe7usaJOkBYJ0U0jiuwGRoUPoT6U9FCavuQluthNzIJ8SIqkwiyTmpV6qsdmHob5\n5vf/8/8+pj11MpeS0HtsbUclWcsldLbWxrgiItO9vBEhe/jgXr6MThx0B6GuFyqz\nCB/kBZFtXZc0TdBlRCSZiNRUAVaRjESoYgEjAWCg6AYwCRaxqQBD0TTJQAxAQNKJ\nBgXEB3jTssPUiTqW7TFbQ1Y0akoK1CQBqIKEqWmamqQiaCqCAWVFgoYMRcyEJRHX\nV7BwBnJpthVhNXYJTcT7B/+fc8cm7AxJEKlgmvKEi4QABEAgAMumoMm6qPugSx0b\n7aSMxkbEdUUg8fEAz6oVFqb+YH+/hi2vJGb8rfAcZBPq+CJvT9Sv7qJG6Lc+ZFg2\nYSNksgrquFbE5oMiI7Fn+QairKoilKGgBHi6O2o5NGT5hKKpUGArwEcdWuE3omJR\nFCkBEAFdM2VVwUgimMgqJgaRTFUmQIAEMgTqEoSqphg61TVZIGwkVOL9jsrtCB8E\nkOVEYebpWmEbeTGH8vG2u8WJXEIKN3XKJP9vcSnJM//8uFPJSeNpJ4us8ZH6ysiJ\nV9HNtbmdX0q7l10d+zT7+UBD+vnq3uWJ8xY1dQerugv3n533rG/4Rpicrp/RyHEZ\nmU05F/vPHQwkDT7sf/GyretjSf/2/Deriqc1pItWVZKdNxhvyR9uKCyfu8U4kZd8\n6XJX+eMLLfVewUDd+Hs0K7c5sab6Q50XzWwsehrtSW0duZO4DgzFF4xmLoxlPM56\nJFZmZOZOmzN/n5LzDVfH83uuzXlF8rLat3odwXel994uPfTg6PrjnSsbam8/acaH\nP4+eORIYbc7LvrVC2fDj0z5v8RX3+ra0ovvTXw+tPt2KuY2DYydrOhOWOGsWbjow\nkr6jr+Dnza/fa38ByARBcQ==\n=qsWl\n-----END PGP MESSAGE-----\n\n```\n\nAnd finally, I am proving ownership of the github account by posting this as a gist.\n\n### My publicly-auditable identity:\n\nhttps://keybase.io/cboss123\n\n### From the command line:\n\nConsider the [keybase command line program](https://keybase.io/download).\n\n```bash\n# look me up\nkeybase id cboss123\n```'
        }
      />
    ))
    .add('Hacker News', () => (
      <PostProof
        {...props}
        platform={'hackernews'}
        proofText={
          '[ my public key: https://keybase.io/awendland; my proof: https://keybase.io/awendland/sigs/akwCq7rlMfq_09mUM911_SYMb018w_jYj22RbZQ2oLQ ]'
        }
      />
    ))
    .add('DNS', () => (
      <PostProof
        {...props}
        platform={'dns'}
        platformUserName={'alexwendland.com'}
        proofText={'keybase-site-verification=EgqpSziQnyApGkOO-Ylm_lJtDIQC7pi9u_xwgYppdTo'}
      />
    ))
    .add('HTTP', () => (
      <PostProof
        {...props}
        platform={'http'}
        platformUserName={'alexwendland.com'}
        proofText={
          '==================================================================\nhttps://keybase.io/awendland\n--------------------------------------------------------------------\n\nI hereby claim:\n\n  * I am an admin of http://www.caleyostrander.com\n  * I am cboss123 (https://keybase.io/cboss123) on keybase.'
        }
        baseUrl={'http://alexwendland.com'}
      />
    ))
}

export default load
