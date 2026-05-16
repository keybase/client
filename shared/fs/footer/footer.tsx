import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import Upload from '@/fs/footer/upload-container'
import Downloads from '@/fs/footer/downloads'
import ProofBroken from '@/fs/footer/proof-broken'

type Props = {
  onlyShowProofBroken?: boolean
  path: T.FS.Path
}

const Footer = (props: Props) => (
  <Kb.Box2 fullWidth={true} direction="vertical">
    {!props.onlyShowProofBroken && <Upload />}
    {!props.onlyShowProofBroken && <Downloads />}
    <ProofBroken path={props.path} />
  </Kb.Box2>
)

export default Footer
