// @flow
import * as React from 'react'
import Box from './box'
import Text from './text'
import {
  globalColors,
  globalStyles,
  platformStyles,
  collapseStyles,
  styleSheetCreate,
  type StylesCrossPlatform,
} from '../styles'

type Props = {
  title: string,
  style?: StylesCrossPlatform,
  size?: 'Small',
  color?: string,
  backgroundColor: string,
  noUppercase?: boolean,
}

const Meta = (props: Props) => (
  <Box
    style={collapseStyles([
      styles.container,
      props.backgroundColor && {backgroundColor: props.backgroundColor},
      props.style,
      props.size === 'Small' && styles.containerSmall,
    ])}
  >
    <Text
      type="Header"
      style={collapseStyles([
        styles.text,
        props.color && {color: props.color},
        props.size === 'Small' && styles.textSmall,
      ])}
    >
      {props.noUppercase ? props.title : props.title.toUpperCase()}
    </Text>
  </Box>
)

const styles = styleSheetCreate({
  container: platformStyles({
    common: {
      ...globalStyles.flexBoxColumn,
      alignItems: 'center',
      alignSelf: 'flex-start',
      borderRadius: 2,
    },
    isElectron: {
      paddingBottom: 1,
      paddingLeft: 2,
      paddingRight: 3,
    },
    isMobile: {
      paddingBottom: 1,
      paddingLeft: 3,
      paddingRight: 3,
      paddingTop: 2,
    },
  }),
  containerSmall: {
    paddingLeft: 2,
    paddingRight: 2,
  },
  text: platformStyles({
    common: {
      color: globalColors.white,
    },
    isElectron: {
      display: 'block',
      fontSize: 11,
      fontWeight: '700',
      lineHeight: '11px',
      paddingTop: 1,
    },
    isMobile: {
      fontSize: 12,
      fontWeight: '700',
      height: 14,
      lineHeight: 14,
    },
  }),
  textSmall: platformStyles({
    isElectron: {
      fontSize: 10,
      lineHeight: '11px',
      marginBottom: -1,
    },
    isMobile: {
      fontSize: 11,
      lineHeight: 13,
    },
  }),
})

export default Meta
