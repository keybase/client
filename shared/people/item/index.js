// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
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
      backgroundColor: props.badged ? Styles.globalColors.blue4 : Styles.globalColors.white,
      borderBottomColor: props.badged ? Styles.globalColors.white : Styles.globalColors.black_10,
    }}
  >
    {!!props.icon && <Kb.Box style={iconContainerStyle}>{props.icon}</Kb.Box>}

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
      style={Styles.collapseStyles([
        timestampContainerStyle,
        props.format === 'multi' ? timestampContainerStyleMulti : timestampContainerStyleSingle,
      ])}
    >
      {!!props.when && <Kb.Text type="BodyTiny">{formatTimeForPeopleItem(props.when.getTime())}</Kb.Text>}
      {props.badged && <Kb.Box style={badgeStyle} />}
    </Kb.Box>
  </Kb.Box>
)

const containerStyle = {
  ...Styles.globalStyles.flexBoxRow,
  borderBottomWidth: 1,
  paddingBottom: Styles.globalMargins.xsmall,
  paddingTop: Styles.globalMargins.xsmall,
  position: 'relative',
  ...(isMobile ? null : {borderStyle: 'solid'}),
}

const iconContainerStyle = {
  marginLeft: Styles.globalMargins.small,
  marginRight: Styles.globalMargins.xsmall,
  width: isMobile ? 48 : 32,
}

const childrenContainerStyle = {
  overflow: 'hidden',
  position: 'relative',
  width: 'auto',
}

const timestampContainerStyle = {
  ...Styles.globalStyles.flexBoxRow,
  alignItems: 'center',
  alignSelf: 'flex-start',
  position: 'absolute',
  right: Styles.globalMargins.small,
}

const timestampContainerStyleMulti = {
  alignSelf: 'flex-start',
  top: Styles.globalMargins.small,
}

const timestampContainerStyleSingle = {
  alignSelf: 'center',
}

const badgeStyle = {
  backgroundColor: Styles.globalColors.orange,
  borderRadius: 6,
  height: 8,
  marginLeft: Styles.globalMargins.xtiny,
  width: 8,
}
