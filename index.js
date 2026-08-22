const pkg = require('./package.json')
const webPkg = require('./any-listen/packages/web-server/package.json')
const path = require('path')
const fs = require('fs')

const join = (...p) => path.join(__dirname, ...p)

// for (const name of pkg['build-packages']) {
//   pkg.dependencies[name] = webPkg.dependencies[name]
// }
try {
  fs.rmSync(join('dist'), { recursive: true })
} catch {}


pkg.dependencies['better-sqlite3'] = webPkg.dependencies['better-sqlite3']

if (process.platform == 'linux') {
  pkg.devDependencies['node-gyp'] = '^12'
  pkg.devDependencies['tar'] = '^7'
}

fs.writeFileSync(
  join('package.json'),
  JSON.stringify(pkg, null, 2) + '\n',
  'utf8'
)

const exec = require('child_process').execSync

exec('npm install --ignore-scripts', { stdio: 'inherit', cwd: __dirname, shell: true })

fs.cpSync(join('node_modules/better-sqlite3/src'), join('./src'), {
  recursive: true,
  force: true,
})
fs.cpSync(join('node_modules/better-sqlite3/deps'), join('./deps'), {
  recursive: true,
  force: true,
})
fs.cpSync(join('node_modules/better-sqlite3/lib'), join('./lib'), {
  recursive: true,
  force: true,
})
fs.cpSync(join('node_modules/better-sqlite3/binding.gyp'), join('./binding.gyp'))
// fs.rmSync(join('node_modules'), { recursive: true })

// exec('npx node-gyp rebuild --release --force_build=1', { stdio: 'inherit', cwd: __dirname, shell: true })

/**
 *
 * @param {string} target
 * @param {string} arch
 */
const cpFiles = async(arch) => {
  const filePaths = [join('build/Release/better_sqlite3.node')]
  for (const filePath of filePaths) {
    fs.cpSync(filePath, join('native', path.basename(filePath)), { recursive: true })
  }
}

const parseDefaultLibVersion = () => {
  const str = fs.readFileSync(join('any-listen/packages/shared/common/constants.ts'), 'utf8').toString()
  const result = /NATIVE_VERSION\s*=\s*([\d]+)/.exec(str)[1]
  return result
}

/**
 *
 */
const build = async() => {
  const arch = process.env.LIB_ARCH || process.arch
  const version = process.env.LIB_VERSION || parseDefaultLibVersion()
  if (!version) throw new Error('LIB_VERSION is not set')

  console.log(`Building for ${process.platform} ${arch}...`)
  exec(`npx node-gyp rebuild --release --force_build=1 --arch=${arch}`, { stdio: 'inherit', cwd: __dirname, shell: true })

  try {
    fs.rmSync(join('native'), { recursive: true })
  } catch {}

  await cpFiles(arch)

  const tar = require('tar')
  const packFile = ({ gzip, cwd, files, dist }) =>
    new Promise((resolve, reject) => {
      tar.c(
        {
          gzip,
          cwd,
        },
        files
      )
        .pipe(fs.createWriteStream(dist))
        .on('finish', resolve)
        .on('error', reject)
    })

  fs.mkdirSync(join('./dist'), {
    recursive: true,
  })
  await packFile({
    gzip: true,
    cwd: join('./native'),
    files: fs.readdirSync(join('./native')),
    dist: join(`dist/${process.platform}_${arch}_v${version}.tar.gz`),
  })
}

build()
