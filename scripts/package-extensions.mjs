import {access, cp, mkdir, readFile, rm, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {cmd as webExt} from 'web-ext'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const extensionDirectory = path.join(repositoryRoot, 'extension')
const artifactsDirectory = path.join(repositoryRoot, 'artifacts')
const stagingDirectory = path.join(artifactsDirectory, 'extensions')
const releaseDirectory = path.join(artifactsDirectory, 'release')
const prepareOnly = process.argv.includes('--prepare-only')

const packageJson = JSON.parse(
  await readFile(path.join(repositoryRoot, 'package.json'), 'utf8'),
)
const sourceManifest = JSON.parse(
  await readFile(path.join(extensionDirectory, 'manifest.json'), 'utf8'),
)
const version = packageJson.version

if (!/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(version)) {
  throw new Error(
    `package.json version "${version}" cannot be used as a browser-extension version`,
  )
}

const sourceEntries = ['visbug.js', 'contextmenu', 'icons', 'toolbar', 'tuts']

for (const entry of sourceEntries) {
  await access(path.join(extensionDirectory, entry))
}

const releaseManifest = () => {
  const manifest = structuredClone(sourceManifest)
  manifest.name = 'VisBug2'
  manifest.version = version
  delete manifest.version_name
  manifest.icons = {128: 'icons/visbug.png'}
  manifest.action.default_icon = {128: 'icons/visbug.png'}
  delete manifest.browser_specific_settings
  return manifest
}

const manifests = {
  chrome: releaseManifest(),
  edge: releaseManifest(),
  firefox: releaseManifest(),
  safari: releaseManifest(),
}

manifests.chrome.background = {
  service_worker: 'visbug.js',
  type: 'module',
}
manifests.edge.background = structuredClone(manifests.chrome.background)
manifests.firefox.background = {
  scripts: ['visbug.js'],
  type: 'module',
}
manifests.firefox.browser_specific_settings = {
  gecko: {
    id: 'visbug2@node-projects.github.io',
    strict_min_version: '142.0',
    data_collection_permissions: {
      required: ['none'],
    },
  },
}
manifests.safari.background = {
  scripts: ['visbug.js'],
  service_worker: 'visbug.js',
  type: 'module',
}

await rm(stagingDirectory, {recursive: true, force: true})
await rm(releaseDirectory, {recursive: true, force: true})
await mkdir(releaseDirectory, {recursive: true})

for (const [browser, manifest] of Object.entries(manifests)) {
  const browserDirectory = path.join(stagingDirectory, browser)
  await mkdir(browserDirectory, {recursive: true})

  for (const entry of sourceEntries) {
    await cp(
      path.join(extensionDirectory, entry),
      path.join(browserDirectory, entry),
      {recursive: true},
    )
  }

  await writeFile(
    path.join(browserDirectory, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  )
}

if (!prepareOnly) {
  for (const browser of ['chrome', 'edge', 'firefox']) {
    await webExt.build({
      sourceDir: path.join(stagingDirectory, browser),
      artifactsDir: releaseDirectory,
      overwriteDest: true,
      filename: `visbug2-${browser}-v${version}.zip`,
    })
  }
}

console.log(
  prepareOnly
    ? `Prepared browser extension sources for ${version}`
    : `Created browser release ZIPs in ${releaseDirectory}`,
)
