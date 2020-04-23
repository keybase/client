import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import {IconType} from '../common-adapters/icon.constants-gen'

type Props = {
  children?: React.ReactNode
  seen: boolean
  noSeparator?: boolean
  primaryButtonClassName?: string
  primaryButtonText?: string
  secondaryButtonText?: string
  onPrimaryButtonClick?: () => void
  onSecondaryButtonClick?: () => void
  image?: IconType
  imageStyle?: Styles.StylesCrossPlatform
  unwrapped?: boolean
}

const NewFeature = (props: Props) => {
  const primaryButton = props.primaryButtonText ? (
    <Kb.Button
      className={props.primaryButtonClassName}
      type="Default"
      mode="Primary"
      small={true}
      label={props.primaryButtonText}
      style={styles.buttons}
      onClick={props.onPrimaryButtonClick}
    />
  ) : null

  const secondaryButton = props.secondaryButtonText ? (
    <Kb.Button
      type="Default"
      mode="Secondary"
      small={true}
      label={props.secondaryButtonText}
      style={styles.buttons}
      onClick={props.onSecondaryButtonClick}
    />
  ) : null
  return (
    <Kb.Box2
      direction="horizontal"
      fullWidth={true}
      style={Styles.collapseStyles([
        styles.rowContainer,
        props.noSeparator ? {marginTop: 0} : {marginTop: Styles.globalMargins.tiny},
      ])}
    >
      {/* Badging */}
      {!props.seen && (
        <Kb.Badge
          height={8}
          badgeStyle={styles.badgeStyle}
          containerStyle={styles.badgeContainerStyle}
          leftRightPadding={4}
        />
      )}
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.contentContainer}>
        {props.unwrapped ? (
          props.children
        ) : (
          <Kb.Text type="BodySmall" allowFontScaling={true}>
            {props.children}
          </Kb.Text>
        )}
        {props.image && (
          <Kb.Box2 direction="vertical" style={styles.imageContainer}>
            <Kb.Icon type={props.image} style={Styles.collapseStyles([styles.image, props.imageStyle])} />
          </Kb.Box2>
        )}
        <Kb.Box2 direction="horizontal" style={styles.buttonRowContainer} gap="xtiny">
          {primaryButton}
          {secondaryButton}
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  badgeContainerStyle: {
    color: Styles.globalColors.transparent,
  },
  badgeStyle: {
    backgroundColor: Styles.globalColors.blue,
    marginRight: Styles.globalMargins.xsmall,
    marginTop: 13,
  },
  buttonRowContainer: {
    ...Styles.globalStyles.flexWrap,
    alignSelf: 'flex-start',
    justifyContent: 'space-between',
  },
  buttons: {
    // Apply margins to buttons so that when they wrap there is vertical space between them
    marginTop: Styles.globalMargins.xsmall,
  },
  contentContainer: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.rounded,
      backgroundColor: Styles.globalColors.white,
      flexShrink: 1,
      paddingBottom: Styles.globalMargins.tiny,
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
      paddingTop: Styles.globalMargins.tiny,
    },
    isTablet: {
      maxWidth: 460,
    },
  }),
  image: {
    alignSelf: 'center',
    maxHeight: 150,
    maxWidth: 300,
  },
  imageContainer: Styles.platformStyles({
    common: {
      marginTop: Styles.globalMargins.tiny,
    },
  }),
  rowContainer: {
    alignSelf: 'flex-start',
  },
}))

export default NewFeature
