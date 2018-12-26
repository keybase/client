// @flow
import * as React from 'react'
import * as Types from '../../constants/types/profile2'
import * as Kb from '../../common-adapters'

type Props = {|
  site: string,
  username: string,
  siteURL: string,
  siteIcon: string,
  proofURL: string,
  state: Types.AssertionState,
  metas: $ReadOnlyArray<Types._AssertionMeta>,
|}

const Assertion = (p: Props) => (
  <Kb.Box2 direction="horizontal">
    <Kb.Text type="Body">{JSON.stringify(p)}</Kb.Text>
  </Kb.Box2>
)

export default Assertion
