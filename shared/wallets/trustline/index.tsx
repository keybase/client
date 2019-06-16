import * as I from 'immutable'
import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/wallets'
import Asset from './asset-container'

type BodyProps = {
  totalAssetsCount: number
  errorMessage?: string
  acceptedAssets: I.List<Types.TrustlineAssetID>
  popularAssets: I.List<Types.TrustlineAssetID>
  searchingAssets?: I.List<Types.TrustlineAssetID>
  onSearchChange: (text: string) => void
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
          data: props.acceptedAssets.toArray(),
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

const Body = (props: BodyProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.body}>
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.searchFilter}>
      <Kb.SearchFilter
        icon="iconfont-search"
        fullWidth={true}
        placeholderText={`Search ${props.totalAssetsCount} assets`}
        onChange={props.onSearchChange}
      />
    </Kb.Box2>
    <Kb.Divider />
    {!!props.errorMessage && <Kb.Banner color="red" text={props.errorMessage} />}
    <Kb.SectionList
      sections={makeSections(props)}
      renderItem={({index, item}) => <Asset firstItem={index === 0} trustlineAssetID={item} />}
      renderSectionHeader={({section}) => sectionHeader(section)}
    />
  </Kb.Box2>
)

const TrustlineDesktop = Kb.HeaderOrPopup((props: Props) => {
  const {onDone, ...rest} = props
  const bodyProps = rest as BodyProps
  return (
    <Kb.Box2 direction="vertical" style={styles.containerDesktop}>
      <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={true} style={styles.headerDesktop}>
        <Kb.Text type="Header">Trustlines</Kb.Text>
      </Kb.Box2>
      <Body {...bodyProps} />
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
    // backgroundColor: Styles.globalColors.red,
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
    height: 48,
  },
  searchFilter: Styles.platformStyles({
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
