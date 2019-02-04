// @flow
import path from 'path'
import fs from 'fs'
import {execSync} from 'child_process'

const prettierWriteAll = () => {
  const blacklist = fs
    .readFileSync(path.join(__dirname, '..', '..', '..', '.prettierignore'), 'utf8')
    .split('\n')
    .map(a => (a.startsWith('shared/') ? `^${a.substr(7)}` : a))
    .filter(Boolean)

  const blackReg = new RegExp(blacklist.join('|'))
  const jsFileReg = new RegExp('\\.js(\\.flow)?$')

  console.log('Using blacklist:', blackReg)

  const files = execSync('git ls-files', {encoding: 'utf8', env: process.env})
    .split('\n')
    .filter(a => jsFileReg.test(a) && !blackReg.test(a))

  execSync(`yarn prettier --write ${files.join(' ')}`, {encoding: 'utf8', env: process.env, stdio: 'inherit'})
}

export default {
  'prettier-write-all': {
    code: prettierWriteAll,
    help: 'Prettier all files',
  },
}
