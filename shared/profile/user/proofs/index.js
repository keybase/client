// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

export type IdentityProvider = {|
  name: string,
  desc: string,
  icon: Kb.IconType,
  new: boolean,
|}

export type Props = {|
  filter: string,
  onBack: () => void,
  onClickLearn: () => void,
  onSetFilter: (filter: string) => void,
  providerClicked: (name: string) => void,
  providers: Array<IdentityProvider>, // in sorted order
|}

const HoverBox = Styles.isMobile
  ? Kb.Box
  : Styles.styled(Kb.Box)({
      ':hover': {backgroundColor: Styles.globalColors.blue4},
    })

class Providers extends React.Component<Props> {
  render() {
    return this.props.providers.map(a => (
      <>
        <Kb.Divider />
        <HoverBox
          fullWidth={true}
          key={a.name}
          onClick={this.props.providerClicked(a.name)}
          style={styles.containerBox}
        >
          <Kb.Icon type={a.icon} style={Kb.iconCastPlatformStyles(styles.icon)} />
          <Kb.Box2 direction="vertical" fullWidth={true}>
            <Kb.Text type="BodySemibold" style={styles.title}>
              {a.name}
            </Kb.Text>
            <Kb.Box2 direction="horizontal" alignItems="flex-start" fullWidth={true}>
              {a.new && <Kb.Meta title="NEW" backgroundColor={Styles.globalColors.blue} style={styles.new} />}
              <Kb.Text type="BodySmall" style={styles.description}>
                {a.desc}
              </Kb.Text>
            </Kb.Box2>
          </Kb.Box2>
          <Kb.Icon
            type="iconfont-arrow-right"
            color={Styles.globalColors.black_50}
            fontSize={Styles.isMobile ? 20 : 16}
            style={styles.iconArrow}
          />
        </HoverBox>
      </>
    ))
  }
}

class ProofsList extends React.Component<Props, State> {
  render() {
    return (
      <Kb.MaybePopup onClose={this.props.onBack} style={styles.mobileFlex}>
        <Kb.Box2 direction="vertical" style={styles.container}>
          <Kb.Text center={true} type="Header" style={styles.header}>
            Prove your...
          </Kb.Text>
          <Kb.Box style={styles.inputContainer}>
            <Kb.Icon
              type="iconfont-search"
              color={Styles.globalColors.black_50}
              fontSize={Styles.isMobile ? 20 : 16}
            />
            <Kb.Input
              hideUnderline={true}
              small={true}
              value={this.props.filter}
              hintText={`Search ${this.props.providers.length} platforms`}
              onChangeText={this.props.onSetFilter}
              style={styles.text}
            />
          </Kb.Box>
          <Kb.Box2 direction="vertical" fullWidth={true} style={styles.listContainer}>
            <Kb.ScrollView>
              <Providers {...this.props} />
            </Kb.ScrollView>
          </Kb.Box2>
          <HoverBox
            centerChildren={true}
            direction="horizontal"
            fullWidth={true}
            onClick={this.props.onClickLearn}
            style={styles.footer}
          >
            <Kb.Icon color={Styles.globalColors.black_50} fontSize={16} type="iconfont-info" />
            <Kb.Text center={true} type="BodySmall" style={styles.footerText}>
              Learn how to list your platform here
            </Kb.Text>
          </HoverBox>
        </Kb.Box2>
      </Kb.MaybePopup>
    )
  }
}

const rightColumnStyle = Styles.platformStyles({
  isElectron: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
})

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    isElectron: {
      height: 525,
      width: 360,
    },
    isMobile: {
      flex: 1,
      width: '100%',
    },
  }),
  containerBox: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'row',
    height: Styles.isMobile ? 56 : 48,
    justifyContent: 'flex-start',
  },
  description: {
    ...rightColumnStyle,
  },
  footer: {
    alignItems: 'center',
    backgroundColor: Styles.globalColors.blueGrey,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    padding: Styles.globalMargins.xsmall,
  },
  footerText: {
    ...rightColumnStyle,
    color: Styles.globalColors.black_60,
    marginLeft: Styles.globalMargins.tiny,
  },
  header: {
    color: Styles.globalColors.black_75,
    marginTop: Styles.globalMargins.tiny,
  },
  icon: {
    alignSelf: 'center',
    height: 32,
    marginLeft: Styles.globalMargins.small,
    marginRight: Styles.globalMargins.small,
  },
  iconArrow: {
    marginRight: Styles.globalMargins.small,
  },
  inputContainer: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      backgroundColor: Styles.globalColors.black_10,
      marginBottom: Styles.globalMargins.xsmall,
      marginTop: Styles.globalMargins.xsmall,
      padding: Styles.globalMargins.tiny,
    },
    isElectron: {
      borderRadius: 4,
      marginLeft: Styles.globalMargins.small,
      marginRight: Styles.globalMargins.small,
    },
  }),
  listContainer: Styles.platformStyles({
    isElectron: {
      maxHeight: 525 - 48,
    },
    isMobile: {
      flex: 1,
    },
  }),
  mobileFlex: Styles.platformStyles({
    isMobile: {flex: 1},
  }),
  new: {
    marginRight: Styles.globalMargins.xtiny,
    marginTop: 1,
  },
  text: {
    color: Styles.globalColors.black_50,
    marginLeft: Styles.globalMargins.tiny,
    marginRight: Styles.globalMargins.tiny,
  },
  title: {
    ...rightColumnStyle,
    color: Styles.globalColors.black_75,
  },
})

export default ProofsList
