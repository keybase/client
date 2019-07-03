import path from 'path'
import fs from 'fs'
import {execSync} from 'child_process'

const prettierWriteAll = () => {
  const blacklist = fs
    .readFileSync(path.join(__dirname, '..', '..', '..', '.prettierignore'), 'utf8')
    .split('\n')
    .filter(Boolean)

  const blackReg = new RegExp(`^(${blacklist.join('|')})`)
  const jsFileReg = /\.(ts|tsx|js)$/

  console.log('Using blacklist:', blackReg)

  const files = execSync('git ls-files', {encoding: 'utf8', env: process.env})
    .split('\n')
    .filter(a => {
      return jsFileReg.test(a) && !blackReg.test(`shared/${a}`)
    })

  execSync(`yarn prettier --write ${files.join(' ')}`, {encoding: 'utf8', env: process.env, stdio: 'inherit'})
}

export default {
  'prettier-write-all': {
    code: prettierWriteAll,
    help: 'Prettier all files',
  },
}
