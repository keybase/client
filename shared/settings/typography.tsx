// Dev-only font debug screen. Gated by __DEV__ in nav and routes — never visible in production.
import * as Kb from '@/common-adapters'
import * as React from 'react'
import type {TextType} from '@/common-adapters/text.shared'

const textTypes: ReadonlyArray<TextType> = [
  'BodyTiny',
  'BodySmall',
  'Body',
  'BodyBig',
  'Header',
  'HeaderBig',
]

const decorationOptions = ['none', 'underline', 'strikethrough', 'underline+strikethrough'] as const
type Decoration = (typeof decorationOptions)[number]

const sampleStrings = [
  'Hamburgefontsiv',
  'Hxpxgy',
  '0123456789',
  'gjpqy ÁÉÍÓÚ ÅÄÖ',
  '~~strike~~ **bold** _italic_',
]

type LayoutMetrics = {
  ascender: number
  descender: number
  capHeight: number
  xHeight: number
  width: number
  height: number
  lineCount: number
}

const SampleRow = ({
  textType,
  decoration,
  sample,
}: {
  textType: TextType
  decoration: Decoration
  sample: string
}) => {
  const [metrics, setMetrics] = React.useState<LayoutMetrics | null>(null)

  const lineThrough =
    decoration === 'strikethrough' || decoration === 'underline+strikethrough'
  const underline = decoration === 'underline' || decoration === 'underline+strikethrough'

  const textStyle = Kb.Styles.platformStyles({
    isElectron: {
      ...(lineThrough ? ({textDecoration: 'line-through'} as object) : {}),
      ...(underline ? ({textDecoration: lineThrough ? 'underline line-through' : 'underline'} as object) : {}),
    },
    isMobile: {
      ...(lineThrough ? {textDecorationLine: underline ? 'underline line-through' : 'line-through'} : {}),
      ...(underline && !lineThrough ? {textDecorationLine: 'underline'} : {}),
    },
  })

  const onTextLayout = Kb.Styles.isMobile
    ? (e: {nativeEvent: {lines: ReadonlyArray<{ascender: number; capHeight: number; descender: number; width: number; height: number; xHeight: number}>}}) => {
        const lines = e.nativeEvent.lines
        if (!lines.length) return
        const first = lines[0]!
        setMetrics({
          ascender: first.ascender,
          capHeight: first.capHeight,
          descender: first.descender,
          height: lines.reduce((s, l) => s + l.height, 0),
          lineCount: lines.length,
          width: Math.max(...lines.map(l => l.width)),
          xHeight: first.xHeight,
        })
      }
    : undefined

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.sampleRow}>
      <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="flex-start" gap="tiny">
        <Kb.Text type="BodyTiny" style={styles.label}>
          {textType}
        </Kb.Text>
        <Kb.Text
          type={textType}
          style={textStyle}
          // @ts-expect-error onTextLayout is RN-only
          onTextLayout={onTextLayout}
        >
          {sample}
        </Kb.Text>
      </Kb.Box2>
      {Kb.Styles.isMobile && metrics ? (
        <Kb.Text type="BodyTiny" style={styles.metricsText}>
          {`asc:${metrics.ascender.toFixed(1)} desc:${metrics.descender.toFixed(1)} cap:${metrics.capHeight.toFixed(1)} x:${metrics.xHeight.toFixed(1)} w:${metrics.width.toFixed(1)} h:${metrics.height.toFixed(1)} lines:${metrics.lineCount}`}
        </Kb.Text>
      ) : null}
    </Kb.Box2>
  )
}

const Typography = () => {
  const [selectedType, setSelectedType] = React.useState<TextType | 'all'>('all')
  const [decoration, setDecoration] = React.useState<Decoration>('strikethrough')
  const [sampleIdx, setSampleIdx] = React.useState(0)
  const [darkBg, setDarkBg] = React.useState(false)

  const sample = sampleStrings[sampleIdx % sampleStrings.length]!
  const types: ReadonlyArray<TextType> = selectedType === 'all' ? textTypes : [selectedType]

  return (
    <Kb.ScrollView
      style={[styles.container, darkBg ? styles.darkBg : styles.lightBg]}
    >
      {/* Controls */}
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.controls} gap="tiny">
        <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" style={styles.controlRow}>
          <Kb.Text type="BodySmallSemibold" style={styles.controlLabel}>Sample</Kb.Text>
          <Kb.Button
            small={true}
            label="Next"
            onClick={() => setSampleIdx(i => i + 1)}
          />
        </Kb.Box2>

        <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" style={styles.controlRow}>
          <Kb.Text type="BodySmallSemibold" style={styles.controlLabel}>Type</Kb.Text>
          <Kb.Box2 direction="horizontal" gap="xtiny" style={styles.wrap}>
            <Kb.Button
              small={true}
              label="all"
              mode={selectedType === 'all' ? 'Primary' : 'Secondary'}
              onClick={() => setSelectedType('all')}
            />
            {textTypes.map(t => (
              <Kb.Button
                key={t}
                small={true}
                label={t}
                mode={selectedType === t ? 'Primary' : 'Secondary'}
                onClick={() => setSelectedType(t)}
              />
            ))}
          </Kb.Box2>
        </Kb.Box2>

        <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" style={styles.controlRow}>
          <Kb.Text type="BodySmallSemibold" style={styles.controlLabel}>Decoration</Kb.Text>
          <Kb.Box2 direction="horizontal" gap="xtiny" style={styles.wrap}>
            {decorationOptions.map(d => (
              <Kb.Button
                key={d}
                small={true}
                label={d}
                mode={decoration === d ? 'Primary' : 'Secondary'}
                onClick={() => setDecoration(d)}
              />
            ))}
          </Kb.Box2>
        </Kb.Box2>

        <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" style={styles.controlRow}>
          <Kb.Text type="BodySmallSemibold" style={styles.controlLabel}>Background</Kb.Text>
          <Kb.Switch on={darkBg} onClick={() => setDarkBg(v => !v)} label="Dark" />
        </Kb.Box2>
      </Kb.Box2>

      <Kb.Divider />

      {/* Samples */}
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.samples}>
        {types.map(t => (
          <SampleRow key={t} textType={t} decoration={decoration} sample={sample} />
        ))}
      </Kb.Box2>

      {/* Markdown sample */}
      <Kb.Divider />
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.samples}>
        <Kb.Text type="BodyTiny" style={styles.label}>Markdown rendering</Kb.Text>
        <Kb.Markdown>{'~~strike~~ **bold** _italic_ `code` [link](https://keybase.io)'}</Kb.Markdown>
      </Kb.Box2>
    </Kb.ScrollView>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: {flex: 1},
  controlLabel: {minWidth: 80},
  controlRow: {alignItems: 'center', flexWrap: 'wrap'},
  controls: {padding: Kb.Styles.globalMargins.small},
  darkBg: {backgroundColor: Kb.Styles.globalColors.blueDarker2},
  label: {color: Kb.Styles.globalColors.black_50, minWidth: 100},
  lightBg: {backgroundColor: Kb.Styles.globalColors.white},
  metricsText: {color: Kb.Styles.globalColors.blue, fontFamily: 'monospace' as const, marginTop: 2},
  sampleRow: {
    borderBottomColor: Kb.Styles.globalColors.black_10,
    borderBottomWidth: 1,
    paddingBottom: Kb.Styles.globalMargins.xtiny,
    paddingTop: Kb.Styles.globalMargins.xtiny,
  },
  samples: {padding: Kb.Styles.globalMargins.small},
  wrap: {flexWrap: 'wrap'},
}))

export default Typography
