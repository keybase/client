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
      props.backgroundColor ? {backgroundColor: props.backgroundColor} : null,
      props.style,
      props.size === 'Small'
        ? {
            paddingLeft: 2,
            paddingRight: 2,
          }
        : null,
    ])}
  >
    <Text
      type="Header"
      style={collapseStyles([
        styles.text,
        props.color ? {color: props.color} : null,
        props.size === 'Small'
          ? platformStyles({
              isMobile: {fontSize: 11, lineHeight: 13},
              isElectron: {fontSize: 10, lineHeight: '12px'},
            })
          : null,
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
      paddingLeft: 2,
      paddingRight: 3,
      paddingBottom: 1,
    },
    isMobile: {
      paddingBottom: 1,
      paddingLeft: 3,
      paddingTop: 2,
      paddingRight: 3,
    },
  }),
  text: platformStyles({
    common: {
      color: globalColors.white,
    },
    isElectron: {
      display: 'block',
      fontSize: 11,
      fontWeight: '700',
      lineHeight: '13px',
    },
    isMobile: {
      fontSize: 12,
      fontWeight: '700',
      height: 14,
      lineHeight: 14,
    },
  }),
})

export default Meta
