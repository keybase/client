// @flow
import * as React from 'react'
import {Box, Text, Icon, Checkbox} from '../../common-adapters'
import {fileUIName, isMobile, isLinux} from '../../constants/platform'
import {globalStyles, globalMargins, globalColors} from '../../styles'
import FileBanner from '../../fs/banner'

type Props = {
  kbfsEnabled: boolean,
  inProgress: boolean,
  onInstall: () => void,
  onUninstall: () => void,
}

const checkBoxComponent = (kbfsEnabled: boolean) => (
  <Box style={globalStyles.flexBoxColumn}>
    <Text type="Body">Enable Keybase in {fileUIName}</Text>
    <Text type="BodySmall">Access your Keybase files just like you normally do with your local files.</Text>
  </Box>
)

const Files = isMobile
  ? () => <Box />
  : ({kbfsEnabled, inProgress, onInstall, onUninstall}: Props) => (
      <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
        <FileBanner
          inProgress={inProgress}
          kbfsEnabled={kbfsEnabled}
          onInstall={onInstall}
          onUninstall={onUninstall}
          showBanner={true}
        />
        <Box style={mainContentStyle}>
          {!isLinux && (
            <Box>
              <Box style={contentHeaderStyle}>
                <Text type="BodySmallSemibold">{fileUIName} integration</Text>
                <Icon type="iconfont-finder" style={contentHeaderIconStyle} />
              </Box>
              <Checkbox
                onCheck={kbfsEnabled ? onUninstall : onInstall}
                labelComponent={checkBoxComponent(kbfsEnabled)}
                checked={kbfsEnabled}
                disabled={inProgress}
              />
            </Box>
          )}
        </Box>
      </Box>
    )

const mainContentStyle = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  paddingTop: globalMargins.medium,
  paddingLeft: globalMargins.tiny,
}

const contentHeaderStyle = {
  ...globalStyles.flexBoxRow,
  paddingBottom: globalMargins.tiny,
}

const contentHeaderIconStyle = {
  fontSize: 16,
  color: globalColors.black_20,
  paddingLeft: globalMargins.tiny,
}

export default Files
