// Dev-only markdown debug screen. Gated by __DEV__ in nav and routes — never visible in production.
import * as Kb from '@/common-adapters'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import {parseMarkdown} from '@/common-adapters/markdown'

type SampleType = {name: string; source: string}
type Section = {title: string; samples: ReadonlyArray<SampleType>}

const sections: ReadonlyArray<Section> = [
  {
    samples: [
      {name: 'plain', source: 'hello world'},
      {name: 'bold', source: 'this is *bold* text'},
      {name: 'italic', source: 'this is _italic_ text'},
      {name: 'strike', source: 'this is ~struck~ text'},
      {name: 'mixed inline', source: '*bold _and italic_ and ~struck~* trailing'},
      {name: 'inline code', source: 'call `foo(bar)` now'},
      {name: 'escapes', source: 'literal \\*not bold\\* and \\_not italic\\_'},
      {name: 'unclosed marks', source: '*bold with no end _and italic with no end'},
    ],
    title: 'Inline',
  },
  {
    samples: [
      {name: 'simple fence', source: '```\nconst a = 1\n```'},
      {name: 'fence with indentation', source: '```\nif (x) {\n    doThing()\n}\n```'},
      {name: 'fence inline with text', source: 'before ```code``` after'},
      {name: 'unterminated fence', source: '```\nnever closed'},
      {name: 'fence containing backticks', source: '```\na ` b `` c\n```'},
      {name: 'double backtick (unsupported)', source: '``not code``'},
    ],
    title: 'Code blocks',
  },
  {
    samples: [
      {name: 'single line', source: '> quoted line'},
      {name: 'multi line', source: '> line one\n> line two\n> line three'},
      {name: 'quote then plain', source: '> quoted line\nplain line'},
      {name: 'blank quoted line', source: '> one\n>\n> two'},
      {name: 'nested quotes', source: '> outer\n> > inner\n> > > deepest'},
      {name: 'inline styles inside quote', source: '> *bold* and _italic_ and `code`'},
    ],
    title: 'Quotes',
  },
  {
    samples: [
      {
        name: 'fully quoted fence (user report)',
        source: '> test one\n> ```\n> hello\n> ```\n> two\n>\n> three',
      },
      {name: 'fully quoted fence only', source: '> ```\n> hello\n> ```'},
      {name: 'quoted fence after text on same line', source: '> they wrote ```\n> foo\n> ```'},
      {name: 'legacy unquoted continuation', source: '> they wrote ```\nfoo\n```'},
      {name: 'quoted fence keeping indentation', source: '> ```\n>   indented\n>     more\n> ```'},
      {name: 'unterminated quoted fence', source: '> ```\n> hello'},
      {name: 'two fences in one quote', source: '> ```\na\n```\n> and\n> ```\n> b\n> ```'},
      {name: 'fence then plain paragraph', source: '> ```\n> code\n> ```\nafter the quote'},
    ],
    title: 'Quotes + code blocks',
  },
  {
    samples: [
      {name: 'link', source: 'go to https://keybase.io now'},
      {name: 'unicode emoji', source: 'nice 👍 work'},
      {name: 'shortname emoji', source: 'nice :+1: work'},
      {name: 'all emoji', source: '😀😀😀'},
      {name: 'spoiler', source: 'the answer is !>42<! ok'},
      {name: 'quoted link + emoji', source: '> see https://keybase.io 👍'},
    ],
    title: 'Links, emoji, spoilers',
  },
  {
    samples: [
      {name: 'leading/trailing whitespace', source: '   spaced   '},
      {name: 'many newlines', source: 'a\n\n\n\nb'},
      {name: 'deeply nested quotes (past limit)', source: '> '.repeat(10) + 'deep'},
      {name: 'lone markers', source: '> \n`\n*\n_'},
    ],
    title: 'Edge cases',
  },
  {
    // The node count next to each of these is the point: every node becomes a react element, so a
    // rule that stops the text run too eagerly costs one element per character.
    samples: [
      {name: 'url in a sentence', source: 'go to https://keybase.io/docs now'},
      {name: 'bare host', source: 'Checkout google.com, they got all the cool gizmos.'},
      {name: 'subdomains', source: 'sub.domain.org here'},
      {name: 'not a tld', source: 'x.comx and notes.commercial and foo.tvx'},
      {name: 'long word before a tld', source: 'a'.repeat(120) + '.com'},
      {name: 'email', source: 'mail me a@b.com please'},
      {name: 'japanese', source: 'こんにちは、今日はいい天気ですね。散歩に行きましょう'},
      {name: 'russian', source: 'привет как дела у меня всё хорошо спасибо большое'},
      {name: 'arabic', source: 'مرحبا كيف حالك اليوم الطقس جميل جدا'},
      {name: 'accents', source: 'voilà une phrase très française avec des accents éèêë'},
      {name: 'punctuation run', source: 'wait.... really??? no!!!'},
      {name: 'abbreviations', source: 'e.g. i.e. etc. v1.2.3 and 1,000.50'},
      {name: 'keycap emoji', source: '0️⃣1️⃣2️⃣ #️⃣ and 👍😀🎉'},
      {name: 'english control', source: 'hello there this is a perfectly normal english sentence'},
    ],
    title: 'Node counts',
  },
]

type Node = {type: string; content?: unknown}
const countNodes = (nodes: Array<Node>): number =>
  nodes.reduce(
    (a, n) => a + (Array.isArray(n.content) ? countNodes(n.content as Array<Node>) : 1),
    0
  )

const Sample = ({name, source}: SampleType) => {
  const styles = useStyles()
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} gap="xtiny" style={styles.sample}>
      <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center">
        <Kb.Text type="BodySmallSemibold">{name}</Kb.Text>
        <Kb.Text type="BodyTiny" style={styles.count}>
          {countNodes(parseMarkdown(source) as Array<Node>)} nodes / {source.length} chars
        </Kb.Text>
      </Kb.Box2>
      <Kb.Text type="BodyTiny" style={styles.source} selectable={true}>
        {JSON.stringify(source)}
      </Kb.Text>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.rendered}>
        <Kb.Markdown selectable={true}>{source}</Kb.Markdown>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const MarkdownDebug = () => {
  const styles = useStyles()
  return (
    <Kb.ScrollView style={styles.scroll} testID={TestIDs.SETTINGS_MARKDOWN}>
      <Kb.Box2 direction="vertical" fullWidth={true} padding="small" gap="tiny">
        {sections.map(section => (
          <Kb.Box2 key={section.title} direction="vertical" fullWidth={true} gap="tiny">
            <Kb.Text type="Header">{section.title}</Kb.Text>
            {section.samples.map(sample => (
              <Sample key={sample.name} name={sample.name} source={sample.source} />
            ))}
          </Kb.Box2>
        ))}
      </Kb.Box2>
    </Kb.ScrollView>
  )
}

const useStyles = Kb.Styles.createStyleHook(theme => ({
  count: {
    color: theme.black_50,
    marginLeft: Kb.Styles.globalMargins.tiny,
  },
  rendered: {
    backgroundColor: theme.white,
    borderColor: theme.black_10,
    borderRadius: Kb.Styles.borderRadius,
    borderStyle: 'solid',
    borderWidth: 1,
    padding: Kb.Styles.globalMargins.xtiny,
  },
  sample: {
    borderTopColor: theme.black_10,
    borderTopWidth: 1,
    paddingBottom: Kb.Styles.globalMargins.xtiny,
    paddingTop: Kb.Styles.globalMargins.xtiny,
  },
  scroll: {flex: 1},
  source: {color: theme.black_50},
}))

export default MarkdownDebug
