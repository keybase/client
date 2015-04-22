

To verify kext signature and permissions:

`codesign -dvvv /Library/Filesystems/osxfusefs.fs/Support/osxfusefs.kext`

`sudo kextutil -l /Library/Filesystems/osxfusefs.fs/Support/osxfusefs.kext`
