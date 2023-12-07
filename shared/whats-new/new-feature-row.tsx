import * as React from 'react'
import * as Kb from '@/common-adapters'
import type {IconType} from '@/common-adapters/icon.constants-gen'

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
  imageStyle?: Kb.Styles.StylesCrossPlatform
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
      style={Kb.Styles.collapseStyles([
        styles.rowContainer,
        props.noSeparator ? {marginTop: 0} : {marginTop: Kb.Styles.globalMargins.tiny},
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
            <Kb.Icon type={props.image} style={Kb.Styles.collapseStyles([styles.image, props.imageStyle])} />
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

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      badgeContainerStyle: {
        color: Kb.Styles.globalColors.transparent,
      },
      badgeStyle: {
        backgroundColor: Kb.Styles.globalColors.blue,
        marginRight: Kb.Styles.globalMargins.xsmall,
        marginTop: 13,
      },
      buttonRowContainer: {
        ...Kb.Styles.globalStyles.flexWrap,
        alignSelf: 'flex-start',
        justifyContent: 'space-between',
      },
      buttons: {
        // Apply margins to buttons so that when they wrap there is vertical space between them
        marginTop: Kb.Styles.globalMargins.xsmall,
      },
      contentContainer: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.globalStyles.rounded,
          backgroundColor: Kb.Styles.globalColors.white,
          flexShrink: 1,
          paddingBottom: Kb.Styles.globalMargins.tiny,
          paddingLeft: Kb.Styles.globalMargins.small,
          paddingRight: Kb.Styles.globalMargins.small,
          paddingTop: Kb.Styles.globalMargins.tiny,
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
      imageContainer: Kb.Styles.platformStyles({
        common: {
          marginTop: Kb.Styles.globalMargins.tiny,
        },
      }),
      rowContainer: {
        alignSelf: 'flex-start',
      },
    }) as const
)

export default NewFeature
