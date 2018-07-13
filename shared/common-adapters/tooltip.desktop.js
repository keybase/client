// @flow
import * as React from 'react'
import {globalMargins, globalColors, transition, styleSheetCreate} from '../styles'
import Text from './text'
import FloatingBox from './floating-box'
import {type Position} from './relative-popup-hoc'

type TooltipProps = {
  position?: Position,
  attachTo?: ?React.Component<any, any>,
  visible: boolean,
  multiline?: boolean,
  text: string,
}

const Tooltip = (props: TooltipProps) =>
  props.visible && (
    <FloatingBox
      position={props.position || 'top center'}
      visible={props.visible}
      attachTo={props.attachTo}
      containerStyle={props.multiline ? styles.containerMultiline : styles.container}
      width={props.multiline ? 320 : undefined}
    >
      <Text type="BodySmall" style={styles.text}>
        {props.text}
      </Text>
    </FloatingBox>
  )

const stylesContainerCommon = {
  ...transition('opacity'),
  alignItems: 'center',
  backgroundColor: globalColors.black_60,
  padding: globalMargins.xtiny,
  paddingLeft: globalMargins.tiny,
  paddingRight: globalMargins.tiny,
  justifyContent: 'center',
  marginBottom: globalMargins.xtiny,
}

const styles = styleSheetCreate({
  container: {
    ...stylesContainerCommon,
    borderRadius: 20,
  },
  containerMultiline: {
    ...stylesContainerCommon,
    borderRadius: 4,
    width: 320,
    minWidth: 320,
    maxWidth: 320,
  },
  text: {
    color: globalColors.white,
    width: 0,
  },
})

export default Tooltip
