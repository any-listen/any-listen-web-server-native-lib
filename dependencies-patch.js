// 修补依赖源码

const fs = require('node:fs')
const path = require('node:path')

const rootPath = path.join(__dirname, './')

const patchs = [
  [
    path.join(rootPath, 'node_modules/prebuild/node_modules/node-abi/abi_registry.json'),
    `  {
    "runtime": "node",
    "target": "24.0.0",
    "lts": [
      "2025-10-28",
      "2026-10-20"
    ],
    "future": false,
    "abi": "134"
  },`,
    `  {
    "runtime": "node",
    "target": "24.0.0",
    "lts": [
      "2025-10-28",
      "2026-10-20"
    ],
    "future": false,
    "abi": "137"
  },`,
  ],
]

;(async() => {
  for (const [filePath, fromStr, toStr] of patchs) {
    console.log(`Patching ${filePath.replace(rootPath, '')}`)
    try {
      const file = (await fs.promises.readFile(filePath)).toString()
      await fs.promises.writeFile(filePath, file.replace(fromStr, toStr))
    } catch (err) {
      console.error(`Patch ${filePath.replace(rootPath, '')} failed: ${err.message}`)
    }
  }
  console.log('\nDependencies patch finished.\n')
})()

