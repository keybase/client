// @flow
import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'

export type Props = {|
  error: string,
  onBack?: ?() => void,
|}

const ErrorLoadingProfile = (props: Props) => (
  <Kb.Box style={{flex: 1, width: 320}}>
    <Kb.Box style={{marginTop: Styles.globalMargins.xlarge}}>
      <Kb.Text center={true} type="BodySmall">
        Error loading profile: {props.error}
      </Kb.Text>
    </Kb.Box>
  </Kb.Box>
)

const WithHeaderHoc = Styles.isMobile ? Kb.HeaderHoc(ErrorLoadingProfile) : ErrorLoadingProfile
const Wrapped = (props: Props) =>
  props.onBack ? <WithHeaderHoc {...props} /> : <ErrorLoadingProfile {...props} />

export default Wrapped
