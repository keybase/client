import * as React from 'react'
import * as Styles from '../../styles'
import {
  Box,
  Button,
  Icon,
  iconCastPlatformStyles,
  Text,
  Overlay,
  OverlayParentHOC,
  OverlayParentProps,
  WithTooltip,
} from '../../common-adapters'
import {fileUIName} from '../../constants/platform'

type Props = {
  driverEnabled: boolean
  enableDriver: () => void
  openInSystemFileManager: () => void
}

const OpenInSystemFileManager = ({openInSystemFileManager}: Props) => (
  <WithTooltip text={`Show in ${fileUIName}`}>
    <Icon
      type="iconfont-finder"
      padding="tiny"
      onClick={openInSystemFileManager}
      color={Styles.globalColors.black_50}
      hoverColor={Styles.globalColors.black}
    />
  </WithTooltip>
)

const FinderPopup = OverlayParentHOC((props: Props & OverlayParentProps) => (
  <>
    <WithTooltip text={`Show in ${fileUIName}`}>
      <Icon
        type="iconfont-finder"
        padding="tiny"
        fontSize={16}
        color={Styles.globalColors.black_50}
        hoverColor={Styles.globalColors.black}
        onClick={props.toggleShowingMenu}
        ref={props.setAttachmentRef}
      />
    </WithTooltip>
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
          <Button type="Success" label="Yes, enable" onClick={props.enableDriver} />
        </Box>
      </Box>
    </Overlay>
  </>
))

export default (props: Props) =>
  props.driverEnabled ? <OpenInSystemFileManager {...props} /> : <FinderPopup {...props} />

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
    paddingBottom: Styles.globalMargins.small,
    textAlign: 'center',
    width: '100%',
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
