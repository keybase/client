import * as React from 'react'
import * as Kb from '../../../../../../common-adapters/index'
import * as Styles from '../../../../../../styles'
import {formatTimeForMessages} from '../../../../../../util/timestamp'
import UnfurlImage from '../image'

export type Props = {
  isCollapsed: boolean
  title: string
  url: string
  siteName: string
  description?: string
  publishTime?: number
  imageURL?: string
  imageHeight?: number
  imageWidth?: number
  imageIsVideo?: boolean
  faviconURL?: string
  onClose?: () => void
  onCollapse: () => void
  showImageOnSide: boolean
}

const UnfurlGeneric = (props: Props) => {
  const {imageURL, imageHeight, imageWidth, showImageOnSide, siteName, publishTime} = props
  const {onClose, title, description, isCollapsed, url, imageIsVideo, onCollapse, faviconURL} = props
  const showBottomImage = !!imageHeight && !!imageWidth && !showImageOnSide
  return (
    <Kb.Box2 style={styles.container} gap="tiny" direction="horizontal">
      {!Styles.isMobile && <Kb.Box2 direction="horizontal" style={styles.quoteContainer} />}
      <Kb.Box2 style={styles.innerContainer} gap="xxtiny" direction="vertical">
        <Kb.Box2 style={styles.siteNameContainer} gap="tiny" fullWidth={true} direction="horizontal">
          {!!faviconURL && <Kb.Image src={faviconURL} style={styles.favicon} />}
          <Kb.BoxGrow>
            <Kb.Text type="BodySmall" lineClamp={1}>
              {siteName}
              {!!publishTime && (
                <Kb.Text type="BodySmall"> • Published {formatTimeForMessages(publishTime)}</Kb.Text>
              )}
            </Kb.Text>
          </Kb.BoxGrow>
          {!!onClose && (
            <Kb.Icon
              type="iconfont-close"
              onClick={onClose}
              style={styles.closeBox}
              padding="xtiny"
              className="unfurl-closebox"
              fontSize={12}
            />
          )}
        </Kb.Box2>
        <Kb.Text type="BodyPrimaryLink" style={styles.url} onClickURL={url}>
          {title}
        </Kb.Text>
        {!!description && (
          <Kb.Text type="Body" lineClamp={5} selectable={true}>
            {description}
            {showBottomImage && (
              <>
                {' '}
                <Kb.Icon
                  boxStyle={styles.collapseBox}
                  noContainer={Styles.isMobile}
                  onClick={onCollapse}
                  sizeType="Tiny"
                  type={isCollapsed ? 'iconfont-caret-right' : 'iconfont-caret-down'}
                />
              </>
            )}
          </Kb.Text>
        )}
        {showBottomImage && !isCollapsed && (
          <Kb.Box2 direction="vertical" fullWidth={true}>
            <UnfurlImage
              url={imageURL || ''}
              linkURL={url}
              height={imageHeight || 0}
              width={imageWidth || 0}
              widthPadding={Styles.isMobile ? Styles.globalMargins.tiny : undefined}
              style={styles.bottomImage}
              isVideo={imageIsVideo || false}
              autoplayVideo={false}
            />
          </Kb.Box2>
        )}
      </Kb.Box2>
      {!Styles.isMobile && showImageOnSide && (
        <Kb.Box2 direction="vertical" style={styles.sideImage}>
          {!!imageURL && <Kb.Image src={imageURL} style={styles.sideImage} />}
        </Kb.Box2>
      )}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      bottomImage: Styles.platformStyles({
        common: {
          marginTop: Styles.globalMargins.xtiny,
        },
        isMobile: {
          alignSelf: 'center',
        },
      }),
      closeBox: Styles.platformStyles({
        isElectron: {
          alignSelf: 'flex-start',
          marginLeft: 'auto',
        },
      }),
      collapseBox: Styles.platformStyles({
        isElectron: {
          display: 'inline',
        },
      }),
      container: Styles.platformStyles({
        common: {
          alignSelf: 'flex-start',
        },
        isElectron: {
          maxWidth: 500,
        },
      }),
      favicon: Styles.platformStyles({
        common: {
          borderRadius: Styles.borderRadius,
          height: 16,
          width: 16,
        },
      }),
      innerContainer: Styles.platformStyles({
        common: {
          alignSelf: 'flex-start',
          minWidth: 150,
        },
        isMobile: {
          borderColor: Styles.globalColors.grey,
          borderRadius: Styles.borderRadius,
          borderWidth: 1,
          padding: Styles.globalMargins.xtiny,
        },
      }),
      quoteContainer: Styles.platformStyles({
        common: {
          alignSelf: 'stretch',
          backgroundColor: Styles.globalColors.grey,
          paddingLeft: Styles.globalMargins.xtiny,
        },
      }),
      sideImage: Styles.platformStyles({
        isElectron: {
          height: 80,
          width: 80,
        },
      }),
      siteNameContainer: Styles.platformStyles({
        common: {
          alignSelf: 'flex-start',
        },
        isElectron: {
          minHeight: 16,
        },
        isMobile: {
          minHeight: 21,
        },
      }),
      url: {
        ...Styles.globalStyles.fontSemibold,
      },
    } as const)
)

export default UnfurlGeneric
