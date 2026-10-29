import fs from 'fs'
import path from 'path'

const files = fs.existsSync(__dirname) ? fs.readdirSync(__dirname).filter(f => !f.endsWith('no-platform-imports.test.ts')) : []

test('the gate dir has code', () => {
  expect(files.filter(f => /\.m?ts$/.test(f) && !f.includes('.test.')).length).toBeGreaterThan(0)
})

test('shared gate code imports nothing from a platform dir', () => {
  for (const f of files) {
    const src = fs.readFileSync(path.join(__dirname, f), 'utf8')
    expect(src).not.toMatch(/from ['"][^'"]*\/(electron|ios-appium|ios)\//)
  }
})
