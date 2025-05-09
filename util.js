exports.formatEnvVersion = (str) => {
  if (!str) return null
  return str.split(',').map((version) => {
    const parts = version.split('.')
    if (parts.length < 3) {
      return version + '.0'.repeat(3 - parts.length)
    }
    return version
  })
}
