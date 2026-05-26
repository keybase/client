// Dev-only font debug screen. Gated by __DEV__ in nav and routes — never visible in production.
import * as Kb from '@/common-adapters'
import * as React from 'react'
import type {TextType} from '@/common-adapters/text.shared'

// Font metrics after this PR (UPM=2048, electron)
// hhea.ascender=2180, hhea.descent=794, sCapHeight=1366, sxHeight=989
const UPM = 2048
const HHEA_ASC = 2180
const HHEA_DESC = 794
const CAP_H = 1366
const X_H = 989

type ZonePos = {baseline: number; cap: number; xh: number; lineHeight: number}

function zonePos(fontSize: number, lineHeight: number): ZonePos {
  const content = ((HHEA_ASC + HHEA_DESC) / UPM) * fontSize
  const halfLeading = (lineHeight - content) / 2
  const baseline = halfLeading + (HHEA_ASC / UPM) * fontSize
  return {
    baseline,
    cap: baseline - (CAP_H / UPM) * fontSize,
    lineHeight,
    xh: baseline - (X_H / UPM) * fontSize,
  }
}

// font-size / line-height from text.css
const TYPE_METRICS: ReadonlyArray<{type: TextType; fs: number; lh: number}> = [
  {fs: 12, lh: 16, type: 'BodyTiny'},
  {fs: 13, lh: 17, type: 'BodySmall'},
  {fs: 14, lh: 18, type: 'Body'},
  {fs: 15, lh: 19, type: 'BodyBig'},
  {fs: 18, lh: 22, type: 'Header'},
  {fs: 24, lh: 28, type: 'HeaderBig'},
]

// ─────────────────────────────────────────────
// Zone overlay — shows baseline / cap / x zones
// ─────────────────────────────────────────────
const ZoneRow = ({type, fs, lh}: {type: TextType; fs: number; lh: number}) => {
  const z = zonePos(fs, lh)
  const clamp = (v: number) => Math.max(0, Math.min(lh, v))
  // coloured bands between zone boundaries
  const bands = [
    {color: '#dbeafe', from: 0, to: clamp(z.cap)},           // ascender zone (blue)
    {color: '#dcfce7', from: clamp(z.cap), to: clamp(z.xh)}, // cap zone (green)
    {color: '#fef9c3', from: clamp(z.xh), to: clamp(z.baseline)}, // x zone (yellow)
    {color: '#fee2e2', from: clamp(z.baseline), to: lh},     // descender zone (red)
  ]
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" alignItems="center" style={styles.zoneRow}>
      <Kb.Text type="BodyTiny" style={styles.label}>{type} {fs}/{lh}</Kb.Text>
      <Kb.Box2 direction="horizontal" relative={true} style={{height: lh, flex: 1}}>
        {/* coloured zone bands */}
        {bands.map((b, i) => (
          <Kb.Box2
            key={i}
            direction="horizontal"
            style={Kb.Styles.platformStyles({
              isElectron: {
                backgroundColor: b.color,
                height: b.to - b.from,
                left: 0,
                position: 'absolute',
                right: 0,
                top: b.from,
              } as object,
            })}
          />
        ))}
        {/* reference lines at cap / x / baseline */}
        {([
          {color: '#166534', label: 'cap', top: z.cap},
          {color: '#854d0e', label: 'x', top: z.xh},
          {color: '#7f1d1d', label: 'base', top: z.baseline},
        ] as const).map(l => (
          <Kb.Box2
            key={l.label}
            direction="horizontal"
            style={Kb.Styles.platformStyles({
              isElectron: {
                borderTopColor: l.color,
                borderTopWidth: 1,
                left: 0,
                position: 'absolute',
                right: 0,
                top: l.top,
              } as object,
            })}
          />
        ))}
        <Kb.Text type={type} style={styles.zoneText}>Hamburgefontsiv gjpqy 0123456789</Kb.Text>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const ZoneSection = () => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.samples} gap="xtiny">
    <Kb.Text type="BodySmallSemibold">Metric zone overlay</Kb.Text>
    <Kb.Text type="BodyTiny" style={styles.hint}>
      Blue=ascender  Green=cap zone  Yellow=x zone  Red=descender{'\n'}
      Lines: dark green=cap-top  brown=x-height  dark red=baseline
    </Kb.Text>
    {TYPE_METRICS.map(m => (
      <ZoneRow key={m.type} {...m} />
    ))}
  </Kb.Box2>
)

// ─────────────────────────────────────────────
// Strikethrough & underline position
// ─────────────────────────────────────────────
const DecorationSection = () => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.samples} gap="xtiny">
    <Kb.Text type="BodySmallSemibold">Strikethrough (yStrikeoutPosition) — should bisect caps optically</Kb.Text>
    {TYPE_METRICS.map(({type}) => (
      <Kb.Box2 key={type} direction="horizontal" fullWidth={true} gap="small" alignItems="center">
        <Kb.Text type="BodyTiny" style={styles.label}>{type}</Kb.Text>
        <Kb.Text type={type} style={styles.strikethrough}>Hamburgefontsiv 0123456789 ÁÉÍÓÚ</Kb.Text>
      </Kb.Box2>
    ))}
    <Kb.Divider style={styles.innerDivider} />
    <Kb.Text type="BodySmallSemibold">Underline (underlinePosition) — should sit just below descenders</Kb.Text>
    {TYPE_METRICS.map(({type}) => (
      <Kb.Box2 key={type} direction="horizontal" fullWidth={true} gap="small" alignItems="center">
        <Kb.Text type="BodyTiny" style={styles.label}>{type}</Kb.Text>
        <Kb.Text type={type} style={styles.underline}>Hamburgefontsiv gjpqy 0123456789</Kb.Text>
      </Kb.Box2>
    ))}
    <Kb.Divider style={styles.innerDivider} />
    <Kb.Text type="BodySmallSemibold">Both together</Kb.Text>
    {TYPE_METRICS.map(({type}) => (
      <Kb.Box2 key={type} direction="horizontal" fullWidth={true} gap="small" alignItems="center">
        <Kb.Text type="BodyTiny" style={styles.label}>{type}</Kb.Text>
        <Kb.Text type={type} style={styles.bothDecoration}>Hamburgefontsiv 0123456789</Kb.Text>
      </Kb.Box2>
    ))}
  </Kb.Box2>
)

// ─────────────────────────────────────────────
// Inline icon + text (sxHeight / vertical-align)
// ─────────────────────────────────────────────
const iconSizePairs = [
  {iconSize: 'Tiny', textType: 'BodyTiny'},
  {iconSize: 'Small', textType: 'BodySmall'},
  {iconSize: 'Default', textType: 'Body'},
  {iconSize: 'Big', textType: 'BodyBig'},
] as const

const InlineIconSection = () => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.samples} gap="xtiny">
    <Kb.Text type="BodySmallSemibold">Inline icon + text (sxHeight → vertical-align: middle)</Kb.Text>
    <Kb.Text type="BodyTiny" style={styles.hint}>Icons should sit at the optical mid-cap of adjacent text</Kb.Text>
    {iconSizePairs.map(({iconSize, textType}) => (
      <Kb.Box2 key={textType} direction="horizontal" fullWidth={true} gap="xtiny" alignItems="center">
        <Kb.Text type="BodyTiny" style={styles.label}>{textType}</Kb.Text>
        <Kb.Icon type="iconfont-keybase" sizeType={iconSize} />
        <Kb.Text type={textType}>Hamburgefontsiv</Kb.Text>
        <Kb.Icon type="iconfont-arrow-right" sizeType={iconSize} />
        <Kb.Text type={textType}>gjpqy 0123456789</Kb.Text>
        <Kb.Icon type="iconfont-check" sizeType={iconSize} />
      </Kb.Box2>
    ))}
    <Kb.Divider style={styles.innerDivider} />
    <Kb.Text type="BodySmallSemibold">Mixed icon + bold + regular inline</Kb.Text>
    {iconSizePairs.map(({iconSize, textType}) => (
      <Kb.Box2 key={textType} direction="horizontal" fullWidth={true} gap="xtiny" alignItems="center" style={styles.inlineRow}>
        <Kb.Text type="BodyTiny" style={styles.label}>{textType}</Kb.Text>
        <Kb.Icon type="iconfont-person" sizeType={iconSize} />
        <Kb.Text type={textType}><Kb.Text type={textType} style={styles.bold}>Bold</Kb.Text> regular <Kb.Text type={textType} style={styles.italic}>italic</Kb.Text></Kb.Text>
      </Kb.Box2>
    ))}
  </Kb.Box2>
)

// ─────────────────────────────────────────────
// Fixed-height container centering (hhea.ascender)
// ─────────────────────────────────────────────
const containerHeights = [16, 20, 24, 28, 32, 40, 48] as const

const CenteringSection = () => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.samples} gap="small">
    <Kb.Text type="BodySmallSemibold">Fixed-height container centering (hhea.ascender)</Kb.Text>
    <Kb.Text type="BodyTiny" style={styles.hint}>Text must be visually centered in each box. Red line = exact center.</Kb.Text>
    <Kb.Box2 direction="horizontal" fullWidth={true} gap="small" alignItems="flex-start" style={styles.wrap}>
      {containerHeights.map(h => (
        <Kb.Box2 key={h} direction="vertical" alignItems="center" gap="xtiny">
          <Kb.Box2
            direction="horizontal"
            centerChildren={true}
            relative={true}
            style={Kb.Styles.collapseStyles([styles.centeredBox, {height: h, minWidth: h + 8}])}
          >
            <Kb.Text type="BodyTinyBold">Ag</Kb.Text>
            {/* exact-center line */}
            <Kb.Box2
              direction="horizontal"
              style={Kb.Styles.platformStyles({
                isElectron: {
                  backgroundColor: 'rgba(239,68,68,0.4)',
                  height: 1,
                  left: 0,
                  position: 'absolute',
                  right: 0,
                  top: h / 2,
                } as object,
              })}
            />
          </Kb.Box2>
          <Kb.Text type="BodyTiny">{h}px</Kb.Text>
        </Kb.Box2>
      ))}
    </Kb.Box2>
    <Kb.Text type="BodySmallSemibold" style={styles.innerDivider}>Badge pills (orange) — same test</Kb.Text>
    <Kb.Box2 direction="horizontal" fullWidth={true} gap="small" alignItems="flex-start" style={styles.wrap}>
      {([1, 9, 42, 99, 999] as const).map(n => (
        <Kb.Box2 key={n} direction="vertical" alignItems="center" gap="xtiny">
          <Kb.Badge badgeNumber={n} />
          <Kb.Text type="BodyTiny">{n}</Kb.Text>
        </Kb.Box2>
      ))}
    </Kb.Box2>
  </Kb.Box2>
)

// ─────────────────────────────────────────────
// Baseline alignment across mixed sizes
// ─────────────────────────────────────────────
const BaselineSection = () => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.samples} gap="xtiny">
    <Kb.Text type="BodySmallSemibold">Baseline alignment — mixed sizes on one line</Kb.Text>
    <Kb.Text type="BodyTiny" style={styles.hint}>All text should share a single baseline regardless of size</Kb.Text>
    {/* On desktop these render as inline spans so baseline aligns naturally */}
    {(['BodyTiny', 'BodySmall', 'Body', 'BodyBig', 'Header'] as const).map((_, i, arr) => (
      <Kb.Box2 key={i} direction="horizontal" fullWidth={true} alignItems="flex-end" gap="xtiny">
        {arr.slice(0, i + 2).map(t => (
          <Kb.Text key={t} type={t}>Hg</Kb.Text>
        ))}
      </Kb.Box2>
    ))}
    <Kb.Divider style={styles.innerDivider} />
    <Kb.Text type="BodySmallSemibold">Weight mixing — bold / regular / semibold same line</Kb.Text>
    {(['BodyTiny', 'BodySmall', 'Body', 'BodyBig'] as const).map(type => (
      <Kb.Box2 key={type} direction="horizontal" fullWidth={true} gap="xtiny" alignItems="center">
        <Kb.Text type="BodyTiny" style={styles.label}>{type}</Kb.Text>
        <Kb.Text type={type}>regular</Kb.Text>
        <Kb.Text type={type} style={styles.bold}> bold </Kb.Text>
        <Kb.Text type={type}>regular</Kb.Text>
        <Kb.Text type={type} style={styles.italic}> italic</Kb.Text>
      </Kb.Box2>
    ))}
  </Kb.Box2>
)

// ─────────────────────────────────────────────
// Multi-line paragraph — line height / leading
// ─────────────────────────────────────────────
const PARA = 'The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs. gjpqy ÁÉÍÓÚ ÅÄÖ 0123456789.'

const LineHeightSection = () => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.samples} gap="small">
    <Kb.Text type="BodySmallSemibold">Multi-line paragraph — line-height / leading (hhea.ascender)</Kb.Text>
    <Kb.Text type="BodyTiny" style={styles.hint}>Lines should be evenly spaced with no clipping or overlap</Kb.Text>
    {TYPE_METRICS.map(({type}) => (
      <Kb.Box2 key={type} direction="vertical" fullWidth={true} style={styles.paraRow} gap="xtiny">
        <Kb.Text type="BodyTiny" style={styles.label}>{type}</Kb.Text>
        <Kb.Text type={type}>{PARA}</Kb.Text>
      </Kb.Box2>
    ))}
  </Kb.Box2>
)

// ─────────────────────────────────────────────
// Cap-height & x-height visual ruler
// ─────────────────────────────────────────────
const RulerSection = () => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.samples} gap="xtiny">
    <Kb.Text type="BodySmallSemibold">Cap-height & x-height uniformity (sCapHeight, sxHeight)</Kb.Text>
    <Kb.Text type="BodyTiny" style={styles.hint}>All caps must reach the same height; x-height glyphs (a e o x) must be consistent</Kb.Text>
    {TYPE_METRICS.map(({type}) => (
      <Kb.Box2 key={type} direction="horizontal" fullWidth={true} gap="small" alignItems="center">
        <Kb.Text type="BodyTiny" style={styles.label}>{type}</Kb.Text>
        <Kb.Text type={type}>ABCDEFGHIJKLMNOPQRSTUVWXYZ</Kb.Text>
      </Kb.Box2>
    ))}
    <Kb.Divider style={styles.innerDivider} />
    {TYPE_METRICS.map(({type}) => (
      <Kb.Box2 key={type} direction="horizontal" fullWidth={true} gap="small" alignItems="center">
        <Kb.Text type="BodyTiny" style={styles.label}>{type}</Kb.Text>
        <Kb.Text type={type}>abcdefghijklmnopqrstuvwxyz</Kb.Text>
      </Kb.Box2>
    ))}
    <Kb.Divider style={styles.innerDivider} />
    <Kb.Text type="BodySmallSemibold">Diacritics — should not clip (usWinAscent)</Kb.Text>
    {TYPE_METRICS.map(({type}) => (
      <Kb.Box2 key={type} direction="horizontal" fullWidth={true} gap="small" alignItems="center">
        <Kb.Text type="BodyTiny" style={styles.label}>{type}</Kb.Text>
        <Kb.Text type={type}>ÁÀÂÄÃÅÆÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜ ÅÄÖ áàâäéèêëíîóôöúùû</Kb.Text>
      </Kb.Box2>
    ))}
  </Kb.Box2>
)

// ─────────────────────────────────────────────
// Markdown — exercises all decoration + weight paths
// ─────────────────────────────────────────────
const MarkdownSection = () => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.samples} gap="small">
    <Kb.Text type="BodySmallSemibold">Markdown rendering</Kb.Text>
    {[
      '~~strikethrough~~ and **bold** and _italic_ together',
      '**bold** `code` [link](https://keybase.io) normal',
      '~~strike **bold strike** strike~~ normal',
      '_italic **bold italic** italic_ normal',
    ].map((md, i) => (
      <Kb.Markdown key={i}>{md}</Kb.Markdown>
    ))}
  </Kb.Box2>
)

// ─────────────────────────────────────────────
// Main sample rows (interactive, from original screen)
// ─────────────────────────────────────────────
const textTypes: ReadonlyArray<TextType> = [
  'BodyTiny', 'BodySmall', 'Body', 'BodyBig', 'Header', 'HeaderBig',
]

const decorationOptions = ['none', 'underline', 'strikethrough', 'underline+strikethrough'] as const
type Decoration = (typeof decorationOptions)[number]

const sampleStrings = [
  'Hamburgefontsiv',
  'Hxpxgy',
  '0123456789',
  'gjpqy ÁÉÍÓÚ ÅÄÖ',
  'The quick brown fox',
]

type LayoutMetrics = {
  ascender: number; descender: number; capHeight: number
  xHeight: number; width: number; height: number; lineCount: number
}

const SampleRow = ({textType, decoration, sample}: {textType: TextType; decoration: Decoration; sample: string}) => {
  const [metrics, setMetrics] = React.useState<LayoutMetrics | null>(null)
  const lineThrough = decoration === 'strikethrough' || decoration === 'underline+strikethrough'
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

  const onTextLayout = isMobile
    ? (e: {nativeEvent: {lines: ReadonlyArray<{ascender: number; capHeight: number; descender: number; width: number; height: number; xHeight: number}>}}) => {
        const lines = e.nativeEvent.lines
        if (!lines.length) return
        const first = lines[0]!
        setMetrics({
          ascender: first.ascender, capHeight: first.capHeight, descender: first.descender,
          height: lines.reduce((s, l) => s + l.height, 0),
          lineCount: lines.length, width: Math.max(...lines.map(l => l.width)), xHeight: first.xHeight,
        })
      }
    : undefined

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.sampleRow}>
      <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="flex-start" gap="tiny">
        <Kb.Text type="BodyTiny" style={styles.label}>{textType}</Kb.Text>
        <Kb.Text type={textType} style={textStyle}
          // @ts-expect-error onTextLayout is RN-only
          onTextLayout={onTextLayout}
        >{sample}</Kb.Text>
      </Kb.Box2>
      {isMobile && metrics ? (
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
    <Kb.ScrollView style={Kb.Styles.collapseStyles([styles.container, darkBg ? styles.darkBg : styles.lightBg])}>
      {/* Controls */}
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.controls} gap="tiny">
        <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" style={styles.controlRow}>
          <Kb.Text type="BodySmallSemibold" style={styles.controlLabel}>Sample</Kb.Text>
          <Kb.Button small={true} label="Next" onClick={() => setSampleIdx(i => i + 1)} />
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" style={styles.controlRow}>
          <Kb.Text type="BodySmallSemibold" style={styles.controlLabel}>Type</Kb.Text>
          <Kb.Box2 direction="horizontal" gap="xtiny" style={styles.wrap}>
            <Kb.Button small={true} label="all" mode={selectedType === 'all' ? 'Primary' : 'Secondary'} onClick={() => setSelectedType('all')} />
            {textTypes.map(t => (
              <Kb.Button key={t} small={true} label={t} mode={selectedType === t ? 'Primary' : 'Secondary'} onClick={() => setSelectedType(t)} />
            ))}
          </Kb.Box2>
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" style={styles.controlRow}>
          <Kb.Text type="BodySmallSemibold" style={styles.controlLabel}>Decoration</Kb.Text>
          <Kb.Box2 direction="horizontal" gap="xtiny" style={styles.wrap}>
            {decorationOptions.map(d => (
              <Kb.Button key={d} small={true} label={d} mode={decoration === d ? 'Primary' : 'Secondary'} onClick={() => setDecoration(d)} />
            ))}
          </Kb.Box2>
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" style={styles.controlRow}>
          <Kb.Text type="BodySmallSemibold" style={styles.controlLabel}>Background</Kb.Text>
          <Kb.Switch on={darkBg} onClick={() => setDarkBg(v => !v)} label="Dark" />
        </Kb.Box2>
      </Kb.Box2>

      <Kb.Divider />
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.samples}>
        {types.map(t => <SampleRow key={t} textType={t} decoration={decoration} sample={sample} />)}
      </Kb.Box2>

      <Kb.Divider />
      <ZoneSection />

      <Kb.Divider />
      <DecorationSection />

      <Kb.Divider />
      <InlineIconSection />

      <Kb.Divider />
      <CenteringSection />

      <Kb.Divider />
      <BaselineSection />

      <Kb.Divider />
      <LineHeightSection />

      <Kb.Divider />
      <RulerSection />

      <Kb.Divider />
      <MarkdownSection />
    </Kb.ScrollView>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  bold: Kb.Styles.platformStyles({isElectron: {fontWeight: 'bold'} as object, isMobile: {fontWeight: 'bold'}}),
  centeredBox: {
    backgroundColor: Kb.Styles.globalColors.blue_10,
    borderColor: Kb.Styles.globalColors.blue,
    borderWidth: 1,
  },
  container: {flex: 1},
  controlLabel: {minWidth: 80},
  controlRow: {alignItems: 'center', flexWrap: 'wrap'},
  controls: {padding: Kb.Styles.globalMargins.small},
  darkBg: {backgroundColor: Kb.Styles.globalColors.blueDarker2},
  hint: {color: Kb.Styles.globalColors.black_50, marginBottom: 4},
  innerDivider: {marginBottom: Kb.Styles.globalMargins.xtiny, marginTop: Kb.Styles.globalMargins.xtiny},
  inlineRow: {flexWrap: 'wrap'},
  italic: Kb.Styles.platformStyles({isElectron: {fontStyle: 'italic'} as object, isMobile: {fontStyle: 'italic'}}),
  label: {color: Kb.Styles.globalColors.black_50, minWidth: 100},
  lightBg: {backgroundColor: Kb.Styles.globalColors.white},
  metricsText: {color: Kb.Styles.globalColors.blue, fontFamily: 'monospace' as const, marginTop: 2},
  bothDecoration: Kb.Styles.platformStyles({
    isElectron: {textDecoration: 'underline line-through'} as object,
    isMobile: {textDecorationLine: 'underline line-through'},
  }),
  paraRow: {
    borderBottomColor: Kb.Styles.globalColors.black_10,
    borderBottomWidth: 1,
    ...Kb.Styles.paddingV(Kb.Styles.globalMargins.xtiny),
  },
  sampleRow: {
    borderBottomColor: Kb.Styles.globalColors.black_10,
    borderBottomWidth: 1,
    ...Kb.Styles.paddingV(Kb.Styles.globalMargins.xtiny),
  },
  samples: {padding: Kb.Styles.globalMargins.small},
  strikethrough: Kb.Styles.platformStyles({
    isElectron: {textDecoration: 'line-through'} as object,
    isMobile: {textDecorationLine: 'line-through'},
  }),
  underline: Kb.Styles.platformStyles({
    isElectron: {textDecoration: 'underline'} as object,
    isMobile: {textDecorationLine: 'underline'},
  }),
  wrap: {flexWrap: 'wrap'},
  zoneRow: {
    borderBottomColor: Kb.Styles.globalColors.black_10,
    borderBottomWidth: 1,
  },
  zoneText: Kb.Styles.platformStyles({
    isElectron: {position: 'absolute', top: 0} as object,
  }),
}))

export default Typography
