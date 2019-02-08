// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import {globalColors, globalStyles, globalMargins} from '../../styles'
import {isMobile} from '../../constants/platform'
import {formatTimeForPeopleItem} from '../../util/timestamp'

export type Props = {
  badged: boolean,
  icon?: React.Node,
  children: React.Node,
  when?: Date,
  contentStyle?: any,
  format?: 'single' | 'multi',
}

export default (props: Props) => (
  <Kb.Box
    style={{
      ...containerStyle,
      backgroundColor: props.badged ? globalColors.blue4 : globalColors.white,
      borderBottomColor: props.badged ? globalColors.white : globalColors.black_10,
    }}
  >
    {props.icon && <Kb.Box style={iconContainerStyle}>{props.icon}</Kb.Box>}

    <Kb.Box2
      direction="vertical"
      gap="xtiny"
      style={{
        ...childrenContainerStyle,
        ...props.contentStyle,
      }}
    >
      {props.children}
    </Kb.Box2>
    <Kb.Box
      style={{
        ...timestampContainerStyle,
        ...(props.format === 'multi' ? timestampContainerStyleMulti : timestampContainerStyleSingle),
      }}
    >
      {!!props.when && <Kb.Text type="BodyTiny">{formatTimeForPeopleItem(props.when.getTime())}</Kb.Text>}
      {props.badged && <Kb.Box style={badgeStyle} />}
    </Kb.Box>
  </Kb.Box>
)

const containerStyle = {
  ...globalStyles.flexBoxRow,
  borderBottomWidth: 1,
  paddingBottom: globalMargins.xsmall,
  paddingTop: globalMargins.xsmall,
  position: 'relative',
  ...(isMobile ? null : {borderStyle: 'solid'}),
}

const iconContainerStyle = {
  marginLeft: globalMargins.small,
  marginRight: globalMargins.xsmall,
  width: isMobile ? 48 : 32,
}

const childrenContainerStyle = {
  overflow: 'hidden',
  position: 'relative',
  width: 'auto',
}

const timestampContainerStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  alignSelf: 'flex-start',
  position: 'absolute',
  right: globalMargins.small,
}

const timestampContainerStyleMulti = {
  alignSelf: 'flex-start',
  top: globalMargins.small,
}

const timestampContainerStyleSingle = {
  alignSelf: 'center',
}

const badgeStyle = {
  backgroundColor: globalColors.orange,
  borderRadius: 6,
  height: 8,
  marginLeft: globalMargins.xtiny,
  width: 8,
}
