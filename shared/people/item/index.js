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
  format?: string,
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
      gap="tiny"
      style={{
        ...childrenContainerStyle,
        ...props.contentStyle,
      }}
    >
      {props.children}
    </Kb.Box2>
    <Kb.Box style={props.format === 'multi' ? timestampContainerStyleMulti : timestampContainerStyleSingle}>
      {!!props.when && <Kb.Text type="BodyTiny">{formatTimeForPeopleItem(props.when.getTime())}</Kb.Text>}
      {props.badged && <Kb.Box style={badgeStyle} />}
    </Kb.Box>
  </Kb.Box>
)

const containerStyle = {
  ...globalStyles.flexBoxRow,
  borderBottomWidth: 1,
  paddingBottom: globalMargins.tiny,
  paddingLeft: globalMargins.small,
  paddingTop: globalMargins.tiny,
  position: 'relative',
  ...(isMobile ? null : {borderStyle: 'solid'}),
}

const iconContainerStyle = {marginRight: 20, width: isMobile ? 48 : 32}

const childrenContainerStyle = {
  overflow: 'hidden',
  paddingRight: isMobile ? globalMargins.large : globalMargins.medium,
  position: 'relative',
  width: 'auto',
}

const timestampContainerStyleMulti = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  alignSelf: 'flex-start',
  position: 'absolute',
  right: globalMargins.small,
  top: globalMargins.xsmall,
}

const timestampContainerStyleSingle = {
  ...timestampContainerStyleMulti,
  alignSelf: 'center',
  top: 'inherit',
}

const badgeStyle = {
  backgroundColor: globalColors.orange,
  borderRadius: 6,
  height: 8,
  marginLeft: globalMargins.xtiny,
  marginTop: isMobile ? 3 : 1,
  width: 8,
}
