import {readFile, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packagePath = path.join(repositoryRoot, 'package.json')
const manifestPath = path.join(repositoryRoot, 'extension', 'manifest.json')
const developmentBuild = process.argv.includes('--dev')

const packageJson = JSON.parse(await readFile(packagePath, 'utf8'))
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))

manifest.version = packageJson.version
manifest.name = developmentBuild ? 'DevBug2' : 'VisBug2'
manifest.icons = {
  128: developmentBuild ? 'icons/visbug-dev.png' : 'icons/visbug.png',
}
manifest.action.default_icon = {
  128: developmentBuild ? 'icons/visbug-dev.png' : 'icons/visbug.png',
}

if (developmentBuild) {
  manifest.version_name = `${packageJson.version} development`
} else {
  delete manifest.version_name
}

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Synchronized extension manifest to ${packageJson.version}`)
