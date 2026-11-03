import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'

// WDA's setValue and clearValue (and the protocol command elementClear under clearValue) leave the
// app's process in hardware-keyboard mode: a later focus draws no software keyboard until the app
// relaunches. So no iOS code calls any of them; fields are cleared and typed with key presses
// (addValue, typeIntoFocused).
const BANNED = new Set(['clearValue', 'elementClear', 'setValue'])

// Android-only code, which the iOS keyboard mode does not touch: as file and enclosing declaration.
const ANDROID_ONLY = [{decl: 'androidEnterText', file: path.join('helpers', 'elements.ts')}]

const ROOT = path.join(__dirname, '..')

const sourceFiles = (dir: string): Array<string> =>
  fs.readdirSync(dir, {withFileTypes: true}).flatMap(d => {
    const p = path.join(dir, d.name)
    if (d.isDirectory()) return d.name === 'node_modules' ? [] : sourceFiles(p)
    return /\.m?ts$/.test(d.name) ? [p] : []
  })

const declaredIn = (n: ts.Node): Array<string> => {
  const names: Array<string> = []
  for (let p = n.parent as ts.Node | undefined; p; p = p.parent) {
    if ((ts.isFunctionDeclaration(p) || ts.isVariableDeclaration(p)) && p.name && ts.isIdentifier(p.name)) names.push(p.name.text)
  }
  return names
}

// Every `.setValue(`, `.clearValue(` or `.elementClear(` call outside ANDROID_ONLY, as file:line.
const bannedCalls = (files: ReadonlyArray<{file: string; text: string}>) => {
  const found: Array<string> = []
  for (const {file, text} of files) {
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
    const walk = (n: ts.Node) => {
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && BANNED.has(n.expression.name.text)) {
        const exempt = ANDROID_ONLY.some(a => a.file === file && declaredIn(n).includes(a.decl))
        if (!exempt) found.push(`${file}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`)
      }
      n.forEachChild(walk)
    }
    walk(sf)
  }
  return found
}

const gateFiles = () =>
  sourceFiles(ROOT)
    .filter(f => f !== __filename)
    .map(f => ({file: path.relative(ROOT, f), text: fs.readFileSync(f, 'utf8')}))

test('no iOS e2e code calls WDA setValue, clearValue or elementClear', () => {
  const files = gateFiles()
  // the scan reads the flows and the helpers, so an empty answer is not a scan that read nothing
  expect(files.some(f => f.file === path.join('helpers', 'files.ts'))).toBe(true)
  expect(files.some(f => f.file.startsWith(`flows${path.sep}`))).toBe(true)
  expect(bannedCalls(files)).toEqual([])
})

test('the scan flags a setValue, clearValue or elementClear call, and spares the Android-only one', () => {
  const files = gateFiles()
  const elements = files.find(f => f.file === path.join('helpers', 'elements.ts'))
  expect(elements?.text).toContain('const androidEnterText')
  const planted = [
    ...files,
    {
      file: path.join('flows', 'planted.ts'),
      text: 'const f = async () => {\n  await el(id).setValue(text)\n  await browser.$(s).clearValue()\n  await browser.elementClear(id)\n}\n',
    },
  ]
  const at = (line: number) => `${path.join('flows', 'planted.ts')}:${line}`
  expect(bannedCalls(planted)).toEqual([at(2), at(3), at(4)])
})
