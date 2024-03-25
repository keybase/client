import * as C from '@/constants'
import * as Constants from '@/constants/fs'
import * as React from 'react'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import TlfType from './rows/tlf-type-container'
import Tlf from './rows/tlf-container'
import SfmiBanner from '../banner/system-file-manager-integration-banner/container'
import {WrapRow} from './rows/rows'

type Props = {
  destinationPickerIndex?: number
}

type SectionListItem = {
  name: string
  tlfType: T.FS.TlfType
}

const rootRows: Array<SectionListItem> = [
  {
    name: T.FS.TlfType.Private,
    tlfType: T.FS.TlfType.Private,
  },
  {
    name: T.FS.TlfType.Public,
    tlfType: T.FS.TlfType.Public,
  },
  {
    name: T.FS.TlfType.Team,
    tlfType: T.FS.TlfType.Team,
  },
]

const getRenderItem =
  (destinationPickerIndex?: number) =>
  ({item, section}: {item: SectionListItem; section: {key: string}}) =>
    section.key === 'section-top' ? (
      <WrapRow>
        <TlfType name={item.name as T.FS.TlfType} destinationPickerIndex={destinationPickerIndex} />
      </WrapRow>
    ) : (
      <WrapRow>
        <Tlf
          disabled={false}
          name={item.name}
          tlfType={item.tlfType}
          mixedMode={true}
          destinationPickerIndex={destinationPickerIndex}
        />
      </WrapRow>
    )

const renderSectionHeader = ({section}: {section: {key: string; title: string}}) =>
  section.key === 'banner-sfmi' ? <SfmiBanner /> : <Kb.SectionDivider label={section.title} />

const useTopNTlfs = (
  tlfType: T.FS.TlfType,
  tlfs: T.FS.TlfList,
  n: number
): Array<{
  name: string
  tlfMtime: number
  tlfType: T.FS.TlfType
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

const useRecentTlfs = (n: number, destinationPickerIndex?: number): Array<SectionListItem> => {
  const tlfs = C.useFSState(s => s.tlfs)
  const username = C.useCurrentUserState(s => s.username)
  const privateTopN = useTopNTlfs(T.FS.TlfType.Private, tlfs.private, n)
  const publicTopN = useTopNTlfs(T.FS.TlfType.Public, tlfs.public, n)
  const teamTopN = useTopNTlfs(T.FS.TlfType.Team, tlfs.team, n)
  return React.useMemo(() => {
    const recent = [...privateTopN, ...publicTopN, ...teamTopN]
      .sort(({tlfMtime: t1}, {tlfMtime: t2}) => t2 - t1)
      .map(({name, tlfType}) => ({name, tlfType}))
    const afterFilter =
      // This isn't perfect since it doesn't cover the case where a team TLF
      // could be readonly. But to do that we'd need some new caching in KBFS
      // to plumb it into the Tlfs structure without awful overhead.
      typeof destinationPickerIndex === 'number'
        ? recent.filter(
            ({name, tlfType}) =>
              !Constants.hideOrDisableInDestinationPicker(tlfType, name, username, destinationPickerIndex)
          )
        : recent
    return afterFilter.slice(0, n)
  }, [destinationPickerIndex, privateTopN, publicTopN, teamTopN, n, username])
}

const Root = React.memo(function Root({destinationPickerIndex}: Props) {
  const top10 = useRecentTlfs(10, destinationPickerIndex)
  const sections = [
    ...(destinationPickerIndex
      ? [] // don't show sfmi banner in destination picker
      : [
          {
            data: new Array<SectionListItem>(),
            key: 'banner-sfmi',
            keyExtractor: () => 'banner-sfmi-item',
            title: '',
          },
        ]),
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
})

export default Root
