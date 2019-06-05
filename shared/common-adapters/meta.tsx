import * as React from 'react'
import Box from './box'
import Text from './text'
import {
  globalColors,
  globalStyles,
  platformStyles,
  collapseStyles,
  styleSheetCreate,
  StylesCrossPlatform,
} from '../styles'

type Props = {
  title: string
  style?: StylesCrossPlatform
  size?: 'Small'
  color?: string
  backgroundColor: string
  noUppercase?: boolean
}

const Meta = (props: Props) => (
  <Box
    pointerEvents="none"
    style={collapseStyles([
      styles.container,
      props.backgroundColor && {backgroundColor: props.backgroundColor},
      props.style,
      props.size === 'Small' && styles.containerSmall,
    ])}
  >
    <Text
      type="BodyTinyBold"
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
  container: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 2,
    paddingLeft: 3,
    paddingRight: 3,
  },
  containerSmall: {
    paddingLeft: 2,
    paddingRight: 2,
  },
  text: platformStyles({
    common: {
      color: globalColors.white,
      marginBottom: -1,
      marginTop: -1,
    },
    isMobile: {
      fontSize: 12,
    },
  }),
  textSmall: platformStyles({
    isElectron: {
      fontSize: 10,
    },
    isMobile: {
      fontSize: 11,
    },
  }),
})

export default Meta
