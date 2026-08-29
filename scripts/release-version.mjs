const tag = process.argv[2]

if (!tag) {
  console.error('Usage: node scripts/release-version.mjs <release-tag>')
  process.exit(1)
}

const match = /^(?:v)?((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))$/.exec(tag)

if (!match) {
  console.error(
    `Release tag "${tag}" is invalid. Use a numeric tag such as v2.1.0 or 2.1.0.`,
  )
  process.exit(1)
}

const version = match[1]
const parts = version.split('.').map(Number)

if (parts.some(part => part > 65535) || parts.every(part => part === 0)) {
  console.error(
    `Release version "${version}" is not a valid browser-extension version.`,
  )
  process.exit(1)
}

process.stdout.write(version)
