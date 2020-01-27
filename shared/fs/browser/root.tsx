import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Kb from '../../common-adapters'
import * as Container from '../../util/container'
import TlfType from './rows/tlf-type-container'
import Tlf from './rows/tlf-container'
import SfmiBanner from '../banner/system-file-manager-integration-banner/container'
import {WrapRow} from './rows/rows'

type Props = {
  destinationPickerIndex?: number
}

type SectionListItem = {
  name: string
  tlfType: Types.TlfType
}

const rootRows = [
  {
    name: Types.TlfType.Private,
    tlfType: Types.TlfType.Private,
  },
  {
    name: Types.TlfType.Public,
    tlfType: Types.TlfType.Public,
  },
  {
    name: Types.TlfType.Team,
    tlfType: Types.TlfType.Team,
  },
]

const getRenderItem = destinationPickerIndex => ({item, section}) =>
  section.key === 'section-top' ? (
    <WrapRow>
      <TlfType name={item.name} destinationPickerIndex={destinationPickerIndex} />
    </WrapRow>
  ) : (
    <WrapRow>
      <Tlf
        name={item.name}
        tlfType={item.tlfType}
        mixedMode={true}
        destinationPickerIndex={destinationPickerIndex}
      />
    </WrapRow>
  )

const renderSectionHeader = ({section}) =>
  section.key === 'banner-sfmi' ? <SfmiBanner /> : <Kb.SectionDivider label={section.title} />

const useTopNTlfs = (
  tlfType: Types.TlfType,
  tlfs: Types.TlfList,
  n: number
): Array<{
  name: string
  tlfMtime: number
  tlfType: Types.TlfType
}> =>
  // TODO move these sorting to Go HOTPOT-433
  React.useMemo(
    () =>
      [...tlfs.values()]
        .filter(({isIgnored}) => !isIgnored)
        .sort((tlf1, tlf2) => tlf2.tlfMtime - tlf1.tlfMtime)
        .slice(0, n)
        .map(({name, tlfMtime}) => ({
          name,
          tlfMtime,
          tlfType,
        })),
    [tlfs, n, tlfType]
  )

const useRecentTlfs = (n: number): Array<SectionListItem> => {
  const tlfs = Container.useSelector(state => state.fs.tlfs)
  const privateTopN = useTopNTlfs(Types.TlfType.Private, tlfs.private, n)
  const publicTopN = useTopNTlfs(Types.TlfType.Public, tlfs.public, n)
  const teamTopN = useTopNTlfs(Types.TlfType.Team, tlfs.team, n)
  return React.useMemo(
    () =>
      [...privateTopN, ...publicTopN, ...teamTopN]
        .sort(({tlfMtime: t1}, {tlfMtime: t2}) => t2 - t1)
        .slice(0, n)
        .map(({name, tlfType}) => ({name, tlfType})),
    [privateTopN, publicTopN, teamTopN, n]
  )
}

const Root = ({destinationPickerIndex}: Props) => {
  const top10 = useRecentTlfs(10)
  const sections = [
    ...(destinationPickerIndex
      ? [] // don't show sfmi banner in destination picker
      : [{data: [], key: 'banner-sfmi', keyExtractor: () => 'banner-sfmi-item', title: ''}]),
    {
      data: rootRows,
      key: 'section-top',
      keyExtractor: (item: SectionListItem) => `top:${item.name}`,
      title: ' ',
    },
    {
      data: top10,
      key: 'section-recent-tlfs',
      keyExtractor: (item: SectionListItem) => `recent-tlfs:${item.tlfType}-${item.name}`,
      title: 'Recent folders',
    },
  ]
  const renderItem = React.useMemo(() => getRenderItem(destinationPickerIndex), [destinationPickerIndex])
  return (
    <Kb.BoxGrow>
      <Kb.SectionList
        sections={sections}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
      />
    </Kb.BoxGrow>
  )
}

export default Root
