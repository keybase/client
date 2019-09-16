import path from 'path'
import fs from 'fs'
import {execSync} from 'child_process'

const getFilesToTest = () => {
  const blacklist = fs
    .readFileSync(path.join(__dirname, '..', '..', '..', '.prettierignore'), 'utf8')
    .split('\n')
    .filter(Boolean)

  const blackReg = new RegExp(`^(${blacklist.join('|')})`)
  const jsFileReg = /\.(ts|tsx|js)$/

  console.log('Using blacklist:', blackReg)

  const files = execSync('git ls-files', {encoding: 'utf8', env: process.env, maxBuffer: 50 * 1024 * 1024})
    .split('\n')
    .filter(a => {
      return jsFileReg.test(a) && !blackReg.test(`shared/${a}`)
    })

  return files
}

const prettierCheck = () => {
  try {
    console.log('Checking prettier')
    execSync(`yarn prettier-bare --list-different ${getFilesToTest().join(' ')}`, {
      encoding: 'utf8',
      env: process.env,
      stdio: [],
    })
  } catch (e) {
    const lines = e.stdout.split('\n')
    const [, ...toPrint] = lines
    toPrint.pop()
    toPrint.pop()
    console.log('Prettier found errors with the following files: \n' + toPrint.join('\n'))
    process.exit(1)
  }
}

const prettierWriteAll = () =>
  execSync(`yarn prettier --write ${getFilesToTest().join(' ')}`, {
    encoding: 'utf8',
    env: process.env,
    stdio: 'inherit',
  })

export default {
  'prettier-check': {
    code: prettierCheck,
    help: 'Test for any misformatted files',
  },
  'prettier-write-all': {
    code: prettierWriteAll,
    help: 'Prettier all files',
  },
}
