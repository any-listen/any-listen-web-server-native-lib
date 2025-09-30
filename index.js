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


fs.writeFileSync(
  join('package.json'),
  JSON.stringify(pkg, null, 2) + '\n',
  'utf8'
)

const exec = require('child_process').execSync

exec('npm install --ignore-scripts', { stdio: 'inherit', cwd: __dirname, shell: true })
exec('node dependencies-patch.js', { stdio: 'inherit', cwd: __dirname, shell: true })

fs.cpSync(join('node_modules/better-sqlite3/src'), join('./src'), {
  recursive: true,
  force: true,
})
fs.cpSync(join('node_modules/better-sqlite3/deps'), join('./deps'), {
  recursive: true,
  force: true,
})
// fs.cpSync(join('node_modules/better-sqlite3/binding.gyp'), join('./binding.gyp'))
// fs.rmSync(join('node_modules'), { recursive: true })

// exec(`npx --no-install -y prebuild -r node -t 16.0.0 --openssl_fips='' --strip --include-regex 'better_sqlite3.node$'`, { stdio: 'inherit', cwd: __dirname, shell: true, env: process.env })

/**
 *
 * @param {string} target
 * @returns
 */
const getNodeAbi = async(target) => (await import('node-abi')).getAbi(target, 'node')

/**
 *
 * @param {string} target
 * @param {string} arch
 */
const unpackFile = async(target, arch) => {
  const filePath = join('./prebuilds', `${pkg.name}-v-node-v${await getNodeAbi(target)}-${process.platform}-${arch}.tar.gz`)
  const dist = join('./native')
  fs.mkdirSync(dist, {
    recursive: true,
  })
  const tar = require('tar')
  await tar.x({
    file: filePath,
    strip: 2,
    C: dist,
  })
}

const parseDefaultLibVersion = () => {
  const str = fs.readFileSync(join('any-listen/packages/shared/common/constants.ts'), 'utf8').toString()
  const result = /NATIVE_VERSION\s*=\s*([\d]+)/.exec(str)[1]
  return result
}

/**
 *
 * @param {string} target
 */
const build = async(target) => {
  // const target = process.env.LIB_TARGET || '18.0.0'
  if (!target) throw new Error('LIB_TARGET is not set')
  const arch = process.env.LIB_ARCH || process.arch
  const version = process.env.LIB_VERSION || parseDefaultLibVersion()
  if (!version) throw new Error('LIB_VERSION is not set')

  if (process.platform == 'win32' && (arch == 'arm64' || arch == 'ia32')) {
    if (ignoreVersion.includes(target)) return
  }

  console.log(`Building for ${process.platform} ${target} ${arch}...`)
  exec(`npx prebuild -r node -a ${arch} -t ${target}${process.platform == 'android' ? '' : ' --strip'}`, { stdio: 'inherit', cwd: __dirname, shell: true })

  try {
    fs.rmSync(join('native'), { recursive: true })
  } catch {}
  // fs.cpSync(join('build/Release/better_sqlite3.node'), join('./native/better_sqlite3.node'), {
  //   recursive: true,
  //   force: true,
  // })
  await unpackFile(target, arch)

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
    dist: join(`dist/${process.platform}_${arch}_${await getNodeAbi(target)}_v${version}.tar.gz`),
  })
}

const defaultVersion = ['18.0.0', '20.0.0', '22.0.0', '24.0.0']
const defaultIgnoreVersion = ['18.0.0']
const { formatEnvVersion } = require('./util')
const ignoreVersion = formatEnvVersion(process.env.IGNORE_NODE_VERSION) || defaultIgnoreVersion
const run = async() => {
  const targets = formatEnvVersion(process.env.DEFAULT_BUILD_NODE_VERSION) || process.env.IS_CI ? defaultVersion : [process.versions.node]
  for await(const target of targets) {
    await build(target)
  }
}

if (process.env.LIB_TARGET) {
  build(process.env.LIB_TARGET)
} else {
  run()
}
