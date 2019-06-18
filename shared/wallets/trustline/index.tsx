import * as I from 'immutable'
import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/wallets'
import Asset from './asset-container'

type BodyProps = {
  accountID: Types.AccountID
  acceptedAssets: I.Map<Types.AssetID, number>
  errorMessage?: string
  loaded: boolean
  onSearchChange: (text: string) => void
  popularAssets: I.List<Types.AssetID>
  refresh: () => void
  searchingAssets?: I.List<Types.AssetID>
  totalAssetsCount?: number
}

type Props = BodyProps & {
  onDone: () => void
}

const makeSections = (props: BodyProps) => [
  ...(props.searchingAssets
    ? [
        {
          data: props.searchingAssets.toArray(),
          key: 'section-search',
          keyExtractor: item => item,
          title: '',
        },
      ]
    : []),
  ...(!props.searchingAssets && props.acceptedAssets.size
    ? [
        {
          data: props.acceptedAssets.keySeq().toArray(),
          key: 'section-accepted',
          keyExtractor: item => item,
          title: 'Accepted assets',
        },
      ]
    : []),
  ...(!props.searchingAssets && props.popularAssets.size
    ? [
        {
          data: props.popularAssets.toArray(),
          key: 'section-popular',
          keyExtractor: item => item,
          title: 'Popular assets',
        },
      ]
    : []),
]

const sectionHeader = section =>
  !section.title || (
    <Kb.Box2 direction="horizontal" alignItems="center" fullWidth={true} style={styles.sectionHeader}>
      <Kb.Text type="BodySmall">{section.title}</Kb.Text>
    </Kb.Box2>
  )

const Body = (props: BodyProps) => {
  React.useEffect(() => props.refresh(), [])
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.body}>
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.searchFilter}>
        <Kb.SearchFilter
          icon="iconfont-search"
          fullWidth={true}
          placeholderText={`Search ${props.totalAssetsCount || 'thousands of'} assets`}
          onChange={props.onSearchChange}
        />
      </Kb.Box2>
      <Kb.Divider />
      {!!props.errorMessage && <Kb.Banner color="red" text={props.errorMessage} />}
      {props.loaded ? (
        <Kb.SectionList
          sections={makeSections(props)}
          renderItem={({index, item}) => (
            <Asset accountID={props.accountID} firstItem={index === 0} assetID={item} />
          )}
          renderSectionHeader={({section}) => sectionHeader(section)}
        />
      ) : (
        <Kb.Box2
          direction="horizontal"
          fullWidth={true}
          style={styles.loadingContainer}
          centerChildren={true}
        >
          <Kb.ProgressIndicator />
        </Kb.Box2>
      )}
    </Kb.Box2>
  )
}

const TrustlineDesktop = Kb.HeaderOrPopup((props: Props) => {
  const {onDone, ...rest} = props
  return (
    <Kb.Box2 direction="vertical" style={styles.containerDesktop}>
      <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={true} style={styles.headerDesktop}>
        <Kb.Text type="Header">Trustlines</Kb.Text>
      </Kb.Box2>
      <Body {...rest} />
      <Kb.Divider />
      <Kb.Button
        type="Default"
        mode="Primary"
        label="Done"
        onClick={props.onDone}
        style={styles.doneButtonDesktop}
      />
    </Kb.Box2>
  )
})

const TrustlineMobile = Kb.HeaderHoc<BodyProps>(Body)

const Trustline = Styles.isMobile
  ? (props: Props) => {
      const {onDone, ...rest} = props
      const bodyProps = rest as BodyProps
      return (
        <TrustlineMobile
          borderless={true}
          title="Trustlines"
          rightActionLabel="Done"
          onRightAction={props.onDone}
          {...bodyProps}
        />
      )
    }
  : (props: Props) => {
      const {onDone} = props
      return <TrustlineDesktop onCancel={onDone} {...props} />
    }

export default Trustline

const styles = Styles.styleSheetCreate({
  body: {
    ...Styles.globalStyles.flexGrow,
  },
  containerDesktop: {
    backgroundColor: Styles.globalColors.white,
    borderRadius: Styles.borderRadius,
    height: 560,
    width: 400,
  },
  doneButtonDesktop: {
    marginBottom: Styles.globalMargins.xsmall,
    marginLeft: Styles.globalMargins.small,
    marginRight: Styles.globalMargins.small,
    marginTop: Styles.globalMargins.xsmall,
  },
  headerDesktop: {
    flexShrink: 0,
    height: 48,
  },
  loadingContainer: {
    ...Styles.globalStyles.flexGrow,
  },
  searchFilter: Styles.platformStyles({
    common: {
      flexShrink: 0,
    },
    isElectron: {
      padding: Styles.globalMargins.tiny,
    },
  }),
  sectionHeader: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.blueGrey,
      paddingLeft: Styles.globalMargins.tiny,
    },
    isElectron: {
      height: Styles.globalMargins.mediumLarge,
    },
    isMobile: {
      height: Styles.globalMargins.large,
    },
  }),
})
