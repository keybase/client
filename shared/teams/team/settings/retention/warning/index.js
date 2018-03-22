// @flow
import * as React from 'react'
import {PopupDialog, ScrollView, Text} from '../../../../../common-adapters'
import {globalStyles, isMobile} from '../../../../../styles'

type Props = {
  days: number,
  enabled: boolean,
  isBigTeam: boolean,
  setEnabled: boolean => void,
  onConfirm: () => void,
  onBack: () => void,
}

const Wrapper = ({children, onBack}) =>
  isMobile ? (
    <ScrollView style={{...globalStyles.fillAbsolute, ...globalStyles.flexBoxColumn}} children={children} />
  ) : (
    <PopupDialog onClose={onBack} children={children} />
  )

const RetentionWarning = (props: Props) => {
  return (
    <Wrapper onBack={props.onBack}>
      <Text type="Body">Hi</Text>
    </Wrapper>
  )
}

export default RetentionWarning
