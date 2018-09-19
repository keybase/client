// @flow
import * as React from 'react'
import * as Styles from '../../styles'
import {
  Box,
  Button,
  ClickableBox,
  Icon,
  iconCastPlatformStyles,
  Text,
  Overlay,
  OverlayParentHOC,
  type OverlayParentProps,
  WithTooltip,
} from '../../common-adapters'
import {fileUIName} from '../../constants/platform'

type OpenInFileUIProps = {
  openInFileUI: () => void,
}

type FinderPopupProps = {
  installFuse: () => void,
}

type Props = {
  kbfsEnabled: boolean,
} & OpenInFileUIProps &
  FinderPopupProps

const OpenInFileUI = ({openInFileUI}: OpenInFileUIProps) => (
  <WithTooltip text="Show in Finder">
    <Icon
      type="iconfont-finder"
      style={iconCastPlatformStyles(styles.pathItemActionIcon)}
      fontSize={16}
      onClick={openInFileUI}
      className="fs-path-item-hover-icon"
    />
  </WithTooltip>
)

const FinderPopup = OverlayParentHOC((props: FinderPopupProps & OverlayParentProps) => (
  <Box>
    <ClickableBox onClick={props.toggleShowingMenu} ref={props.setAttachmentRef}>
      <Icon
        type="iconfont-finder"
        style={iconCastPlatformStyles(styles.pathItemActionIcon)}
        fontSize={16}
        className="fs-path-item-hover-icon"
      />
    </ClickableBox>
    <Overlay
      style={styles.popup}
      attachTo={props.getAttachmentRef}
      visible={props.showingMenu}
      onHidden={props.toggleShowingMenu}
      position="bottom right"
    >
      <Box style={styles.header}>
        <Icon type="icon-fancy-finder-132-96" style={iconCastPlatformStyles(styles.fancyFinderIcon)} />
        <Text type="BodyBig" style={styles.text}>
          Enable Keybase in {fileUIName}?
        </Text>
        <Text type="BodySmall" style={styles.text}>
          Get access to your files and folders just like you normally do with your local files. It's encrypted
          and secure.
        </Text>
        <Box style={styles.buttonBox}>
          <Button type="PrimaryGreen" label="Yes, enable" onClick={props.installFuse} />
        </Box>
      </Box>
    </Overlay>
  </Box>
))

const styles = Styles.styleSheetCreate({
  pathItemActionIcon: {
    padding: Styles.globalMargins.tiny,
  },
  text: {
    paddingTop: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
  },
  fancyFinderIcon: {
    paddingTop: Styles.globalMargins.medium,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
  },
  buttonBox: {
    paddingTop: Styles.globalMargins.small,
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
  },
  header: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    width: '100%',
  },
  popup: {
    marginTop: Styles.globalMargins.tiny,
    width: 220,
    overflow: 'visible',
    backgroundColor: Styles.globalColors.white,
  },
})

export default (props: Props) =>
  props.kbfsEnabled ? (
    <OpenInFileUI openInFileUI={props.openInFileUI} />
  ) : (
    <FinderPopup installFuse={props.installFuse} />
  )
