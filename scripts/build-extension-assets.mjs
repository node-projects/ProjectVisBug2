import {access, copyFile, cp, mkdir, rm} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appDirectory = path.join(repositoryRoot, 'app')
const extensionDirectory = path.join(repositoryRoot, 'extension')
const toolbarDirectory = path.join(extensionDirectory, 'toolbar')

const requiredInputs = [
  path.join(appDirectory, 'bundle.min.js'),
  path.join(appDirectory, 'chunks'),
  path.join(appDirectory, 'tuts'),
]

for (const input of requiredInputs) {
  await access(input)
}

await mkdir(toolbarDirectory, {recursive: true})
await copyFile(
  path.join(appDirectory, 'bundle.min.js'),
  path.join(toolbarDirectory, 'bundle.min.js'),
)

const toolbarChunks = path.join(toolbarDirectory, 'chunks')
await rm(toolbarChunks, {recursive: true, force: true})
await cp(path.join(appDirectory, 'chunks'), toolbarChunks, {recursive: true})

const extensionTutorials = path.join(extensionDirectory, 'tuts')
await rm(extensionTutorials, {recursive: true, force: true})
await cp(path.join(appDirectory, 'tuts'), extensionTutorials, {recursive: true})

console.log('Copied generated JavaScript and tutorial assets into extension/')
