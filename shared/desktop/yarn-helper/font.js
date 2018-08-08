// @flow
/* eslint-disable sort-keys */
import fs from 'fs'
import path from 'path'
import {execSync} from 'child_process'
import prettier from 'prettier'
import webfontsGenerator from 'webfonts-generator'

const commands = {
  'updated-fonts': {
    code: updatedFonts,
    help: 'Update our font sizes automatically',
  },
  'unused-assets': {
    code: unusedAssetes,
    help: 'Find unused assets',
  },
}

const baseCharCode = 0xe900

const iconfontRegex = /^kb-iconfont-(.*)-(\d+).svg$/

/*
 * ADD NEW SVG FILES TO THE END OF THIS LIST
 *
 * The script will go sequentially and increase the code point for each SVG. We
 * do this to avoid shifting the code points of all icons after inserting a new
 * one in the middle.
 *
 */
const svgFiles = [
  'kb-iconfont-add-16.svg',
  'kb-iconfont-arrow-down-16.svg',
  'kb-iconfont-arrow-full-down-16.svg',
  'kb-iconfont-arrow-full-up-16.svg',
  'kb-iconfont-arrow-left-16.svg',
  'kb-iconfont-arrow-right-16.svg',
  'kb-iconfont-arrow-up-16.svg',
  'kb-iconfont-attachment-16.svg',
  'kb-iconfont-bomb-16.svg',
  'kb-iconfont-boom-16.svg',
  'kb-iconfont-camera-16.svg',
  'kb-iconfont-camera-off-16.svg',
  'kb-iconfont-caret-down-8.svg',
  'kb-iconfont-caret-right-8.svg',
  'kb-iconfont-chat-16.svg',
  'kb-iconfont-check-16.svg',
  'kb-iconfont-clipboard-16.svg',
  'kb-iconfont-clock-16.svg',
  'kb-iconfont-close-16.svg',
  'kb-iconfont-compose-16.svg',
  'kb-iconfont-crown-admin-16.svg',
  'kb-iconfont-crown-owner-16.svg',
  'kb-iconfont-dollar-sign-16.svg',
  'kb-iconfont-download-16.svg',
  'kb-iconfont-download-2-16.svg',
  'kb-iconfont-edit-16.svg',
  'kb-iconfont-ellipsis-16.svg',
  'kb-iconfont-emoji-16.svg',
  'kb-iconfont-exclamation-16.svg',
  'kb-iconfont-file-note-16.svg',
  'kb-iconfont-finder-16.svg',
  'kb-iconfont-fire-16.svg',
  'kb-iconfont-folder-downloads-16.svg',
  'kb-iconfont-folder-dropdown-16.svg',
  'kb-iconfont-folder-new-16.svg',
  'kb-iconfont-folder-open-16.svg',
  'kb-iconfont-folder-private-16.svg',
  'kb-iconfont-folder-private-me-16.svg',
  'kb-iconfont-folder-public-16.svg',
  'kb-iconfont-folder-public-me-16.svg',
  'kb-iconfont-folder-up-16.svg',
  'kb-iconfont-gear-16.svg',
  'kb-iconfont-hamburger-16.svg',
  'kb-iconfont-hand-wave-16.svg',
  'kb-iconfont-identity-bitcoin-16.svg',
  'kb-iconfont-identity-devices-16.svg',
  'kb-iconfont-identity-facebook-16.svg',
  'kb-iconfont-identity-github-16.svg',
  'kb-iconfont-identity-hn-16.svg',
  'kb-iconfont-identity-pgp-16.svg',
  'kb-iconfont-identity-reddit-16.svg',
  'kb-iconfont-identity-twitter-16.svg',
  'kb-iconfont-identity-website-16.svg',
  'kb-iconfont-identity-zcash-16.svg',
  'kb-iconfont-info-16.svg',
  'kb-iconfont-keybase-16.svg',
  'kb-iconfont-leave-16.svg',
  'kb-iconfont-link-16.svg',
  'kb-iconfont-lock-16.svg',
  'kb-iconfont-mention-16.svg',
  'kb-iconfont-nav-chat-24.svg',
  'kb-iconfont-nav-devices-24.svg',
  'kb-iconfont-nav-files-24.svg',
  'kb-iconfont-nav-folders-24.svg',
  'kb-iconfont-nav-git-24.svg',
  'kb-iconfont-nav-more-24.svg',
  'kb-iconfont-nav-people-24.svg',
  'kb-iconfont-nav-settings-24.svg',
  'kb-iconfont-nav-teams-24.svg',
  'kb-iconfont-nav-wallets-24.svg',
  'kb-iconfont-new-16.svg',
  'kb-iconfont-notifications-desktop-16.svg',
  'kb-iconfont-notifications-mobile-16.svg',
  'kb-iconfont-open-browser-16.svg',
  'kb-iconfont-people-16.svg',
  'kb-iconfont-proof-broken-16.svg',
  'kb-iconfont-proof-good-16.svg',
  'kb-iconfont-proof-pending-16.svg',
  'kb-iconfont-proof-placeholder-16.svg',
  'kb-iconfont-qr-code-16.svg',
  'kb-iconfont-question-mark-16.svg',
  'kb-iconfont-reacji-16.svg',
  'kb-iconfont-reacji-heart-16.svg',
  'kb-iconfont-reacji-sheep-16.svg',
  'kb-iconfont-reacji-wave-16.svg',
  'kb-iconfont-refresh-16.svg',
  'kb-iconfont-remove-16.svg',
  'kb-iconfont-search-16.svg',
  'kb-iconfont-shh-16.svg',
  'kb-iconfont-star-16.svg',
  'kb-iconfont-stellar-request-16.svg',
  'kb-iconfont-stellar-send-16.svg',
  'kb-iconfont-success-16.svg',
  'kb-iconfont-team-join-16.svg',
  'kb-iconfont-team-leave-16.svg',
  'kb-iconfont-text-code-16.svg',
  'kb-iconfont-thunderbolt-16.svg',
  'kb-iconfont-time-16.svg',
  'kb-iconfont-time-reversed-16.svg',
  'kb-iconfont-timer-16.svg',
  'kb-iconfont-trash-16.svg',
  'kb-iconfont-tweet-16.svg',
  'kb-iconfont-upload-16.svg',
  'kb-iconfont-upload-2-16.svg',
  'kb-iconfont-usercard-16.svg',
  'kb-iconfont-wrenches-16.svg',
]

const svgPaths = svgFiles.map(file => path.resolve(__dirname, '../../images/iconfont', file))

/*
 * If new svg files are added or removed and don't match the number of files in svgFiles, log a warning
 * so the human will add or remove the file paths from this file
 */
function checkSvgFiles() {
  const svgFilesDir = fs
    .readdirSync(path.resolve(__dirname, '../../images/iconfont'))
    .filter(file => file.match(iconfontRegex))

  if (svgFiles.length > svgFilesDir.length) {
    const missing = svgFiles.filter(f => !svgFilesDir.includes(f))
    console.warn(
      'Missing svg files in shared/imags/iconfont. Some svg files were specified but are missing. You might need to update shared/desktop/yarn-helpers/font.js',
      missing
    )
  }

  if (svgFiles.length < svgFilesDir.length) {
    const extra = svgFilesDir.filter(f => !svgFiles.includes(f))
    console.warn(
      'New svg files in shared/imags/iconfont. Some svg files were added but not specified in svgFiles. You might need to update shared/desktop/yarn-helpers/font.js',
      extra
    )
  }
}

/*
 * This function will read all of the SVG files specified above, and generate a single ttf iconfont from the svgs.
 * webfonts-generator will write the file to `dest`
 *
 * For config options: https://github.com/sunflowerdeath/webfonts-generator
 */
function updatedFonts() {
  checkSvgFiles()
  console.log('Created new webfont')
  webfontsGenerator(
    {
      // An intermediate svgfont will be generated and then converted to TTF by webfonts-generator
      types: ['ttf'],
      files: svgPaths,
      dest: path.resolve(__dirname, '../../fonts/'),
      startCodepoint: baseCharCode,
      fontName: 'kb',
      css: false,
      html: false,
      formatOptions: {
        ttf: {
          ts: Date.now(),
        },
        svg: {
          center: true,
          normalize: true,
          fontHeight: 200,
          // round: 10e18, // precision to round svg paths
        },
      },
    },
    error => (error ? fontsGeneratedError(error) : fontsGeneratedSuccess())
  )
}

function fontsGeneratedSuccess() {
  console.log('Webfont generated successfully... updating constants and flow types')
  // Webfonts generator seems always produce an svg fontfile regardless of the `type` option set above.
  const svgFont = path.resolve(__dirname, '../../fonts/kb.svg')
  if (fs.existsSync(svgFont)) {
    fs.unlinkSync(svgFont)
  }
  updateConstants()
}

function fontsGeneratedError(error) {
  console.error('Shit broke', error)
  throw new Error(
    `Failed to generate ttf iconfont file. Check that all svgs exist and the destination directory exits.`
  )
}

function updateConstants() {
  console.log('Generating icon constants')

  const icons = {}

  // Build constants for the png assests.
  fs
    .readdirSync(path.join(__dirname, '../../images/icons'))
    .filter(i => i.indexOf('@') === -1 && i.startsWith('icon-'))
    .forEach(i => {
      const shortName = i.slice(0, -4)
      icons[shortName] = {
        extension: i.slice(-3),
        isFont: false,
        require: `'../images/icons/${i}'`,
      }
    })

  // Build constants for iconfont svgs
  svgFiles.forEach((path, index) => {
    const match = path.match(iconfontRegex)
    if (!match || match.length !== 3) return

    const name = match[1]
    const size = match[2]

    icons[`iconfont-${name}`] = {
      isFont: true,
      gridSize: size,
      charCode: baseCharCode + index,
    }
  })

  const iconConstants = `// @flow
  // This file is GENERATED by yarn run updated-fonts. DON'T hand edit
  /* eslint-disable prettier/prettier */

  type IconMeta = {
    isFont: boolean,
    gridSize?: number,
    extension?: string,
    charCode?: number,
    require?: any,
  }

  const iconMeta_ = {
  ${
    /* eslint-disable */
    Object.keys(icons)
      .map(name => {
        const icon = icons[name]
        const meta = [`isFont: ${icon.isFont},`]
        if (icon.gridSize) {
          meta.push(`gridSize: ${icons[name].gridSize},`)
        }
        if (icon.extension) {
          meta.push(`extension: '${icons[name].extension}',`)
        }
        if (icon.charCode) {
          meta.push(`charCode: 0x${icons[name].charCode.toString(16)},`)
        }
        if (icon.require) {
          meta.push(`require: require(${icons[name].require}),`)
        }

        return `'${name}': {
      ${meta.join('\n')}
    },`
      })
      .join('\n')
  }/* eslint-enable */
  }

  export type IconType = $Keys<typeof iconMeta_>
  export const iconMeta: {[key: IconType]: IconMeta} = iconMeta_
  `

  const filename = path.join(__dirname, '../../common-adapters/icon.constants.js')
  // $FlowIssue
  fs.writeFileSync(filename, prettier.format(iconConstants, prettier.resolveConfig.sync(filename)), 'utf8')
}
function unusedAssetes() {
  const allFiles = fs.readdirSync(path.join(__dirname, '../../images/icons'))

  // map of root name => [files]
  const images = {}
  allFiles.forEach(f => {
    const parsed = path.parse(f)
    if (!['.jpg', '.png'].includes(parsed.ext)) {
      return
    }

    let root = parsed.name
    const atFiles = root.match(/(.*)@[23]x$/)
    if (atFiles) {
      root = atFiles[1]
    }

    if (!images[root]) {
      images[root] = []
    }
    images[root].push(f)
  })

  Object.keys(images).forEach(image => {
    const command = `ag --ignore "./common-adapters/icon.constants.js" "${image}"`
    try {
      execSync(command, {encoding: 'utf8', env: process.env})
    } catch (e) {
      if (e.status === 1) {
        console.log(images[image].join('\n'))
      }
    }
  })
}

export default commands
