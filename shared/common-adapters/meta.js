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
  color?: string,
  backgroundColor: string,
}

const Meta = (props: Props) => (
  <Box
    style={collapseStyles([
      styles.container,
      props.backgroundColor ? {backgroundColor: props.backgroundColor} : null,
      props.style,
    ])}
  >
    <Text type="Header" style={collapseStyles([styles.text, props.color ? {color: props.color} : null])}>
      {props.title.toUpperCase()}
    </Text>
  </Box>
)

const styles = styleSheetCreate({
  container: platformStyles({
    common: {
      ...globalStyles.flexBoxColumn,
      alignItems: 'center',
      alignSelf: 'flex-start',
      borderRadius: 1,
    },
    isElectron: {
      paddingLeft: 4,
      paddingRight: 4,
    },
    isMobile: {
      padding: 2,
    },
  }),
  text: platformStyles({
    common: {
      color: globalColors.white,
    },
    isElectron: {
      display: 'block',
      fontSize: 10,
      fontWeight: '700',
      lineHeight: 'initial',
    },
    isMobile: {
      fontSize: 11,
      fontWeight: '700',
      height: 13,
      lineHeight: 13,
    },
  }),
})

export default Meta
