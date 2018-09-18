// @flow
import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'

export type Props = {|
  error: string,
  onBack?: ?() => void,
|}

const ErrorLoadingProfile = (props: Props) => (
  <Kb.Box style={{width: 320, flex: 1}}>
    <Kb.Box style={{marginTop: Styles.globalMargins.xlarge}}>
      <Kb.Text type="BodySmall" style={{textAlign: 'center'}}>
        Error loading profile: {props.error}
      </Kb.Text>
    </Kb.Box>
  </Kb.Box>
)

const WithHeaderHoc = Styles.isMobile ? Kb.HeaderHoc(ErrorLoadingProfile) : ErrorLoadingProfile
const Wrapped = (props: Props) =>
  props.onBack ? <WithHeaderHoc {...props} /> : <ErrorLoadingProfile {...props} />

export default Wrapped
