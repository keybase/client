import * as React from 'react'
import Box from './box'
import Text from './text'
import * as Styles from '../styles'

type Props = {
  title: string
  style?: Styles.StylesCrossPlatform
  size?: 'Small'
  color?: string
  backgroundColor: string
  noUppercase?: boolean
}

const Meta = (props: Props) => (
  <Box
    pointerEvents="none"
    style={Styles.collapseStyles([
      styles.container,
      props.backgroundColor && {backgroundColor: props.backgroundColor},
      props.style,
      props.size === 'Small' && styles.containerSmall,
    ])}
  >
    <Text
      type="BodyTinyBold"
      style={Styles.collapseStyles([
        styles.text,
        props.color && {color: props.color},
        props.size === 'Small' && styles.textSmall,
      ])}
    >
      {props.noUppercase ? props.title : props.title.toUpperCase()}
    </Text>
  </Box>
)

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.globalStyles.flexBoxColumn,
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
  text: Styles.platformStyles({
    common: {
      color: Styles.globalColors.white,
      marginBottom: -1,
      marginTop: -1,
    },
    isMobile: {
      fontSize: 12,
    },
  }),
  textSmall: Styles.platformStyles({
    isElectron: {
      fontSize: 10,
    },
    isMobile: {
      fontSize: 11,
    },
  }),
}))

export default Meta
