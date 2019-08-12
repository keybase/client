import path from 'path'

global.KB = {
  path: {
    join: path.join,
  },
  process: {
    env: process.env,
    platform: process.platform,
  },
}
