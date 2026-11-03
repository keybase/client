import fs from 'fs'
import path from 'path'

const files = fs.existsSync(__dirname)
  ? (fs.readdirSync(__dirname, {recursive: true}) as Array<string>).filter(f => /\.m?tsx?$/.test(f) && !f.endsWith('no-platform-imports.test.ts'))
  : []

test('the gate dir has code', () => {
  expect(files.filter(f => /\.m?ts$/.test(f) && !f.includes('.test.')).length).toBeGreaterThan(0)
})

test('shared gate code imports nothing from a platform dir', () => {
  for (const f of files) {
    const src = fs.readFileSync(path.join(__dirname, f), 'utf8')
    expect(src).not.toMatch(/(?:from\s*|import\s*\(?\s*)['"][^'"]*\/(electron|ios-appium|ios)\//)
  }
})

test('iOS gate code imports nothing from the desktop gate', () => {
  const ios = path.join(__dirname, '../../ios-appium')
  const iosFiles = (fs.readdirSync(ios, {recursive: true}) as Array<string>).filter(f => /\.m?tsx?$/.test(f))
  expect(iosFiles.length).toBeGreaterThan(0)
  for (const f of iosFiles) {
    const src = fs.readFileSync(path.join(ios, f), 'utf8')
    expect(`${f}: ${src}`).not.toMatch(/(?:from\s*|import\s*\(?\s*)['"][^'"]*\/electron\//)
  }
})
