// @flow
import * as React from 'react'
import {Box, Text, Icon, Checkbox, ClickableBox} from '../../common-adapters'
import {fileUIName, isMobile, isLinux} from '../../constants/platform'
import {globalStyles, globalMargins, globalColors} from '../../styles'
import FileBanner from '../../fs/banner/fileui-banner'

type Props = {
  kbfsEnabled: boolean,
  inProgress: boolean,
  showSecurityPrefsLink: boolean,
  showSecurityPrefs: () => void,
  onInstall: () => void,
  onUninstall: () => void,
}

const checkBoxComponent = (
  <Box style={globalStyles.flexBoxColumn}>
    <Text type="Body">Enable Keybase in {fileUIName}</Text>
    <Text type="BodySmall">Access your Keybase files just like you normally do with your local files.</Text>
  </Box>
)

const Files = isMobile
  ? () => <Box />
  : ({kbfsEnabled, inProgress, showSecurityPrefsLink, onInstall, onUninstall, showSecurityPrefs}: Props) => (
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
                <Icon
                  type="iconfont-finder"
                  style={contentHeaderIconStyle}
                  fontSize={16}
                  color={globalColors.black_20}
                />
                {showSecurityPrefsLink && (
                  <ClickableBox style={actionNeededBoxStyle} onClick={showSecurityPrefs}>
                    <Text style={actionNeededTextStyle} type="BodySmallSemibold">
                      Action needed!
                    </Text>
                  </ClickableBox>
                )}
              </Box>
              <Checkbox
                onCheck={kbfsEnabled ? onUninstall : onInstall}
                labelComponent={checkBoxComponent}
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
  paddingLeft: globalMargins.tiny,
  paddingTop: globalMargins.medium,
}

const contentHeaderStyle = {
  ...globalStyles.flexBoxRow,
  paddingBottom: globalMargins.tiny,
}

const contentHeaderIconStyle = {
  paddingLeft: globalMargins.tiny,
}

const actionNeededBoxStyle = {
  marginLeft: globalMargins.medium,
}

const actionNeededTextStyle = {
  color: globalColors.red,
}

export default Files
