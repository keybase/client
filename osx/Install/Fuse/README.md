

To sign kext:

`codesign --verbose --sign "Developer ID Application: Keybase, Inc." osxfuse.fs.bundle/Support/osxfusefs.kext`

To verify kext signature:

`codesign -dvvv osxfuse.fs.bundle/Support/osxfusefs.kext`

To verify kext after install:

`sudo kextutil -l /Library/Filesystems/osxfusefs.fs/Support/osxfusefs.kext`
