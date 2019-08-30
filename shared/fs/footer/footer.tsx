import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/fs'
import Upload from './upload-container'
import Downloads from './downloads-container'
import ProofBroken from './proof-broken'

type Props = {
  onlyShowProofBroken?: boolean
  path: Types.Path
}

const Footer = (props: Props) => (
  <Kb.Box2 fullWidth={true} direction="vertical">
    {!props.onlyShowProofBroken && <Upload />}
    {!props.onlyShowProofBroken && <Downloads />}
    <ProofBroken path={props.path} />
  </Kb.Box2>
)

export default Footer
