// A test of tooling that only runs on macOS: it needs a macOS tool (sips, lsof, expect) or APFS
// behavior (a deleted file's inode is not handed straight to the next file, as ext4 does). CI runs
// the unit tests on Linux, where it is skipped.
export const macTest = process.platform === 'darwin' ? test : test.skip
