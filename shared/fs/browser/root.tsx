import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import TlfType from './rows/tlf-type'
import Tlf from './rows/tlf'
import {useFsTlfs} from '../common'
import SfmiBanner from '../banner/system-file-manager-integration-banner/container'
import {WrapRow} from './rows/rows'
import * as FS from '@/stores/fs'
import {useCurrentUserState} from '@/stores/current-user'

type Props = {
  destinationPickerSource?: T.FS.MoveOrCopySource | T.FS.IncomingShareSource
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

const getRenderItem = (destinationPickerSource?: T.FS.MoveOrCopySource | T.FS.IncomingShareSource) =>
  function WrapTLF({item, section}: {item: SectionListItem; section: {key: string}}) {
    return section.key === 'section-top' ? (
      <WrapRow>
        <TlfType name={item.name as T.FS.TlfType} destinationPickerSource={destinationPickerSource} />
      </WrapRow>
    ) : (
      <WrapRow>
        <Tlf
          disabled={false}
          name={item.name}
          tlfType={item.tlfType}
          mixedMode={true}
          destinationPickerSource={destinationPickerSource}
        />
      </WrapRow>
    )
  }

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
  [...tlfs.values()]
    .filter(({isIgnored}) => !isIgnored)
    .sort((tlf1, tlf2) => tlf2.tlfMtime - tlf1.tlfMtime)
    .slice(0, n)
    .map(({name, tlfMtime}) => ({
      name,
      tlfMtime,
      tlfType,
    }))

const useRecentTlfs = (
  n: number,
  destinationPickerSource?: T.FS.MoveOrCopySource | T.FS.IncomingShareSource
): Array<SectionListItem> => {
  const tlfs = useFsTlfs()
  const username = useCurrentUserState(s => s.username)
  const privateTopN = useTopNTlfs(T.FS.TlfType.Private, tlfs.private, n)
  const publicTopN = useTopNTlfs(T.FS.TlfType.Public, tlfs.public, n)
  const teamTopN = useTopNTlfs(T.FS.TlfType.Team, tlfs.team, n)
  const recent = [...privateTopN, ...publicTopN, ...teamTopN]
    .sort(({tlfMtime: t1}, {tlfMtime: t2}) => t2 - t1)
    .map(({name, tlfType}) => ({name, tlfType}))
  const afterFilter =
    // This isn't perfect since it doesn't cover the case where a team TLF
    // could be readonly. But to do that we'd need some new caching in KBFS
    // to plumb it into the Tlfs structure without awful overhead.
    destinationPickerSource
      ? recent.filter(
          ({name, tlfType}) =>
            !FS.hideOrDisableInDestinationPicker(tlfType, name, username, true)
        )
      : recent
  return afterFilter.slice(0, n)
}

function Root({destinationPickerSource}: Props) {
  const top10 = useRecentTlfs(10, destinationPickerSource)
  const sections = [
    ...(destinationPickerSource
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
  const renderItem = getRenderItem(destinationPickerSource)

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
