import * as React from 'react'
import * as Types from '../../../constants/types/tracker2'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {SiteIcon} from '../shared'
import {makeInsertMatcher} from '../../../util/string'

export type IdentityProvider = {
  name: string
  desc: string
  icon: Types.SiteIconSet
  key: string
  new: boolean
}

export type Props = {
  onCancel: () => void
  onClickLearn: () => void
  providerClicked: (key: string) => void
  providers: Array<IdentityProvider>
  title: string
}

const HoverBox = Styles.isMobile
  ? Kb.ClickableBox
  : Styles.styled(Kb.ClickableBox)({
      ':hover': {backgroundColor: Styles.globalColors.blueLighter2},
    })

type ProvidersProps = {
  filter: string
} & Props

class Providers extends React.Component<ProvidersProps> {
  static _itemHeight = {
    height: Styles.isMobile ? 56 : 48,
    type: 'fixed',
  } as const
  _renderItem = (_, provider) => (
    <React.Fragment key={provider.name}>
      <Kb.Divider />
      <HoverBox onClick={() => this.props.providerClicked(provider.key)} style={styles.containerBox}>
        <SiteIcon set={provider.icon} style={styles.icon} full={true} />
        <Kb.Box2 direction="vertical" fullWidth={true}>
          <Kb.Text type="BodySemibold" style={styles.title}>
            {provider.name}
          </Kb.Text>
          {(provider.new || !!provider.desc) && (
            <Kb.Box2 direction="horizontal" alignItems="flex-start" fullWidth={true}>
              {provider.new && (
                <Kb.Meta title="NEW" backgroundColor={Styles.globalColors.blue} style={styles.new} />
              )}
              <Kb.Text type="BodySmall" style={styles.description}>
                {provider.desc}
              </Kb.Text>
            </Kb.Box2>
          )}
        </Kb.Box2>
        <Kb.Icon
          type="iconfont-arrow-right"
          color={Styles.globalColors.black_50}
          fontSize={Styles.isMobile ? 20 : 16}
          style={styles.iconArrow}
        />
      </HoverBox>
    </React.Fragment>
  )
  render() {
    const filterRegexp = makeInsertMatcher(this.props.filter)

    const items = this.props.providers.filter(p => filterProvider(p, filterRegexp))
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.flexOne}>
          <Kb.List2 items={items} renderItem={this._renderItem} itemHeight={Providers._itemHeight} />
        </Kb.Box2>
      </Kb.Box2>
    )
  }
}

const normalizeForFiltering = input => input.toLowerCase().replace(/[.\s]/g, '')

const filterProvider = (p, filter) => {
  return normalizeForFiltering(p.name).match(filter) || normalizeForFiltering(p.desc).match(filter)
}

type State = {
  filter: string
}

class _ProofsList extends React.Component<Props, State> {
  state = {filter: ''}
  _onSetFilter = filter => this.setState({filter})
  render() {
    return (
      <Kb.Box style={styles.mobileFlex}>
        <Kb.Box2 direction="vertical" style={styles.container}>
          {!Styles.isMobile && (
            <Kb.Text center={true} type="Header" style={styles.header}>
              Prove your...
            </Kb.Text>
          )}
          <Kb.Box style={styles.inputContainer}>
            <Kb.Icon
              type="iconfont-search"
              color={Styles.globalColors.black_50}
              fontSize={Styles.isMobile ? 20 : 16}
            />
            <Kb.PlainInput
              autoFocus={true}
              placeholder={`Search ${this.props.providers.length} platforms`}
              placeholderColor={Styles.globalColors.black_50}
              flexable={true}
              multiline={false}
              onChangeText={this._onSetFilter}
              type="text"
              style={styles.text}
              value={this.state.filter}
            />
          </Kb.Box>
          <Kb.Box2 direction="vertical" fullWidth={true} style={styles.listContainer}>
            <Providers {...this.props} filter={this.state.filter} />
            <Kb.Divider />
          </Kb.Box2>
          <HoverBox onClick={this.props.onClickLearn} style={styles.footer}>
            <Kb.Icon color={Styles.globalColors.black_50} fontSize={16} type="iconfont-info" />
            <Kb.Text center={true} type="BodySmall" style={styles.footerText}>
              Learn how to list your platform here
            </Kb.Text>
          </HoverBox>
        </Kb.Box2>
      </Kb.Box>
    )
  }
}
const ProofsList = Kb.HeaderOrPopup(_ProofsList)

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
      borderRadius: 4,
      height: 485,
      overflow: 'hidden',
      width: 560,
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
  flexOne: {
    flex: 1,
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
    color: Styles.globalColors.black_50,
    marginLeft: Styles.globalMargins.tiny,
  },
  header: {
    color: Styles.globalColors.black,
    marginTop: Styles.globalMargins.tiny,
  },
  icon: {
    height: 32,
    marginLeft: Styles.globalMargins.small,
    marginRight: Styles.globalMargins.small,
    width: 32,
  },
  iconArrow: {
    marginRight: Styles.globalMargins.small,
  },
  inputContainer: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    backgroundColor: Styles.globalColors.black_10,
    borderRadius: Styles.borderRadius,
    marginBottom: Styles.globalMargins.xsmall,
    marginLeft: Styles.globalMargins.small,
    marginRight: Styles.globalMargins.small,
    marginTop: Styles.globalMargins.xsmall,
    padding: Styles.globalMargins.tiny,
  },
  listContainer: Styles.platformStyles({
    common: {
      flex: 1,
    },
    isElectron: {
      maxHeight: 560 - 48,
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
    backgroundColor: Styles.globalColors.transparent,
    color: Styles.globalColors.black_50,
    marginLeft: Styles.globalMargins.tiny,
    marginRight: Styles.globalMargins.tiny,
  },
  title: {
    ...rightColumnStyle,
    color: Styles.globalColors.black,
  },
})

export default ProofsList
