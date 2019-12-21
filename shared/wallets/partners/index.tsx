import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/wallets'
import {IconType} from '../../common-adapters/icon.constants-gen'
import openUrl from '../../util/open-url'

type PartnerRowProps = {
  extra: string
  description: string
  iconFilename: IconType
  title: string
  url: string
}

const PartnerRow = (props: PartnerRowProps) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny">
    <Kb.Icon
      type={props.iconFilename}
      colorOverride={Styles.globalColors.black}
      fontSize={32}
      style={styles.partnerIcon}
    />
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.yesShrink}>
      <Kb.ClickableBox
        className="hover-underline-container"
        onClick={() => openUrl(props.url)}
        style={styles.partnerLinkContainer}
      >
        <Kb.Text className="hover-underline-child" style={styles.partnerLink} type="BodyPrimaryLink">
          {props.title}
        </Kb.Text>
        <Kb.Icon fontSize={Styles.isMobile ? 16 : 12} style={styles.openIcon} type="iconfont-open-browser" />
      </Kb.ClickableBox>
      <Kb.Text type="BodySmall">{props.description}</Kb.Text>
    </Kb.Box2>
    <Kb.Box2 direction="vertical" style={styles.noShrink} />
  </Kb.Box2>
)

type Props = {
  externalPartners: Array<Types.PartnerUrl>
  onDone: () => void
  refresh: () => void
}

class Partners extends React.Component<Props> {
  componentDidMount() {
    this.props.refresh()
  }

  render() {
    return (
      <Kb.Modal
        banners={[
          <Kb.Banner key="banner" color="yellow">
            <Kb.BannerParagraph
              bannerColor="yellow"
              content="Partners listed here are not affiliated with Keybase and are listed for convenience only. If you choose to visit a partner, that partner will see your Keybase username and Stellar address."
            />
          </Kb.Banner>,
        ]}
        footer={{content: <Kb.Button fullWidth={true} label="Done" onClick={this.props.onDone} />}}
        header={{title: 'External partners'}}
        onClose={this.props.onDone}
      >
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.partnerContainer}>
          {this.props.externalPartners.map(partner => (
            <Kb.Box2 key={partner.url} direction="vertical" fullWidth={true}>
              <PartnerRow
                description={partner.description}
                extra={partner.extra}
                iconFilename={partner.iconFilename as IconType}
                title={partner.title}
                url={partner.url}
              />
              <Kb.Divider style={styles.partnerDivider} />
            </Kb.Box2>
          ))}
        </Kb.Box2>
      </Kb.Modal>
    )
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      externalPartnersText: {
        marginBottom: Styles.globalMargins.tiny,
      },
      noShrink: {flexShrink: 0},
      openIcon: Styles.platformStyles({
        common: {
          left: Styles.globalMargins.xtiny,
          position: 'relative',
        },
        isElectron: {
          top: Styles.globalMargins.xtiny,
        },
      }),
      partnerContainer: {
        marginBottom: 16,
        marginTop: 16,
      },
      partnerDivider: {
        marginBottom: Styles.globalMargins.tiny,
        marginLeft: 64,
        marginTop: Styles.globalMargins.tiny,
      },
      partnerIcon: {
        flexShrink: 0,
        height: 32,
        marginLeft: 16,
        marginRight: 8,
        width: 32,
      },
      partnerLink: {color: Styles.globalColors.black},
      partnerLinkContainer: {
        ...Styles.globalStyles.flexBoxRow,
        alignSelf: 'flex-start',
      },
      yesShrink: {flexShrink: 1},
    } as const)
)

export default Partners
