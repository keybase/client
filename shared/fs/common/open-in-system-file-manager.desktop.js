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

type OpenInSystemFileManagerProps = {
  openInSystemFileManager: () => void,
}

type FinderPopupProps = {
  installFuse: () => void,
}

type Props = {
  kbfsEnabled: boolean,
} & OpenInSystemFileManagerProps &
  FinderPopupProps

const OpenInSystemFileManager = ({openInSystemFileManager}: OpenInSystemFileManagerProps) => (
  <WithTooltip text={`Show in ${fileUIName}`}>
    <Icon
      type="iconfont-finder"
      style={iconCastPlatformStyles(styles.pathItemActionIcon)}
      fontSize={16}
      onClick={openInSystemFileManager}
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
  buttonBox: {
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.small,
  },
  fancyFinderIcon: {
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.medium,
  },
  header: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    width: '100%',
  },
  pathItemActionIcon: {
    padding: Styles.globalMargins.tiny,
  },
  popup: {
    backgroundColor: Styles.globalColors.white,
    marginTop: Styles.globalMargins.tiny,
    overflow: 'visible',
    width: 220,
  },
  text: {
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.tiny,
  },
})

export default (props: Props) =>
  props.kbfsEnabled ? (
    <OpenInSystemFileManager openInSystemFileManager={props.openInSystemFileManager} />
  ) : (
    <FinderPopup installFuse={props.installFuse} />
  )
