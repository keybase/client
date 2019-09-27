import React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'

type Props = {
  text: string
  seen: boolean
  imageSrc?: string
  primaryButton: boolean
  primaryButtonText?: string
  primaryButtonPath?: string
  primaryButtonExternal?: boolean
  secondaryButton: boolean
  secondaryButtonText?: string
  secondaryButtonPath?: string
  secondaryButtonExternal?: boolean
}

const NewFeature = (props: Props) => {
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.container}>
      {/* Badging */}
      {!props.seen && (
        <Kb.Badge height={8} badgeStyle={styles.badgeStyle} containerStyle={styles.badgeContainerStyle} />
      )}
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.contentContainer}>
        <Kb.Text type="Body">{props.text}</Kb.Text>
        <Kb.Box2 direction="vertical" style={styles.imageContainer}>
          {props.imageSrc && <Kb.Image src={props.imageSrc} style={styles.image} />}
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" style={styles.buttonRowContainer} gap="tiny">
          {props.primaryButton && (
            <Kb.Button type="Default" mode="Primary" label={props.primaryButtonText} style={styles.buttons} />
          )}
          {props.secondaryButton && (
            <Kb.Button
              type="Default"
              mode="Secondary"
              label={props.secondaryButtonText}
              style={styles.buttons}
            />
          )}
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
  container: {
    ...Styles.globalStyles.fullWidth,
    alignSelf: 'flex-start',
  },
  contentContainer: {
    backgroundColor: Styles.globalColors.white,
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.tiny,
  },
  image: {
    alignSelf: 'center',
    maxHeight: 96,
    maxWidth: 216,
  },
  imageContainer: {},
}))

export default NewFeature
