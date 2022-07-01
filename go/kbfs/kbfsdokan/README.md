The main executable for running KBFS on Windows.

Dokan is a user mode filesystem library for Windows.

Dokan implements a binding to dokan.dll.
Libdokan implements a library binding of KBFS and Dokan.
Kbfsdokan is the filesystem executable for KBFS on Dokan that works like kbfsfuse.

## Normal installation is by installing Keybase on Windows which includes kbfsdokan

## Installation by hand

### Install Dokan from https://github.com/dokan-dev/dokany/releases/tag/v0.8.0

### Install a C toolchain

+ Mingw is ancient but should work
+ Msys2 works
+ Mingw64 works
+ Take care to differentiate between 32 and 64 bit toolchain
+ Add the toolchain to the path (e.g. C:\msys32\mingw32\bin)
+ Currently Keybase uses a 32 bit toolchain for Windows

### Build kbfsdokan

```cd kbfs/kbfsdokan && go build```

### Alternatively build with more low level dokan debugging

```cd kbfs/kbfsdokan && go build -tags debug```

### Troubleshooting: keep the correct dokan.dll + dokan.lib available for the build!

+ 32-bit builds want 32 bit dokan.dll and dokan.lib.
+ 64-bit builds want 64 bit dokan.dll and don't need a lib-file.

The correct files with 0.8.0 for 32 bit are:

```
dokan.lib           size:  5500 bytes         sha1: 1c9316a567b805c4a6adaf0abe1424fffb36a3bd
dokan.dll           size: 53488 bytes         sha1: 5c4fc6b6e3083e575eed06de3115a6d05b30db02
```

### Troubleshooting

### `C source files not allowed when not using cgo or SWIG: bridge.c`

This is caused by cgo not being enabled (e.g. 64 bit windows go toolchain and GOARCH=386).
Fix this by setting CGO_ENABLED=1 and recheck `go env`.

### `undefined reference to `_imp__DokanMain@8'`

32-bit build and dokan.lib is missing? Make it available!

## Try it out like kbfsfuse:

For local only functionality:
```kbfsdokan.exe -debug -localuser <user> -bserver=memory -mdserver=memory M:```
For normal functionality:
```kbfsdokan.exe -debug -log-to-file M:```

## From an another console

```
M:
cd \public
cd <user>
dir
mkdir foo
notepad bar.txt
```

# Symlink destinations from outside KBFS to KBFS

Windows makes paths case insentive in symlink destination. KBFS has
support for this in the case that the case insensitive path is unique
and guessable.

To make this work make symlinks from outside KBFS to KBFS make it refer
to either the root of the drive or use `PRIVATE` or `PUBLIC` in the path
instead of `private` and `public`. This enables the case insentive path
resolving logic inside KBFS.

e.g.
```
C:
cd \tmp
mklink /D link1 K:\
mklink /D link2 K:\PRIVATE
mklink /D link3 K:\PRIVATE\user1,user2
```

Note that symbolic link creation (mklink) requires admin privileges.
