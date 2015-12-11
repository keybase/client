# kbfsdokan, libdokan and dokan

Dokan is a user mode filesystem library for Windows.

Dokan implements a binding to dokan.dll, libdokan the
libkbfs dokan interface and kbfsdokan a simple program
for trying it out.

## Install Dokan from https://github.com/dokan-dev/dokany/releases/tag/v0.8.0-RC4

## Install a C toolchain

+ Mingw is ancient
+ Msys2 works
+ Mingw64 works
+ Take care to differentiate between 32 and 64 bit toolchain
+ Add the toolchain to the path (e.g. C:\msys32\mingw32\bin)

## Build kbfsdokan

```cd kbfs/kbfsdokan && go build```

## Alternatively build with more low level dokan debugging

```cd kbfs/kbfsdokan && go build -tags debug```

## Troubleshooting: keep the correct dokan.dll + dokan.lib available for the build!

+ 32-bit builds want 32 bit dokan.dll and dokan.lib.
+ 64-bit builds want 64 bit dokan.dll and don't need a lib-file.

The correct files with 0.8.0-RC4 for 32 bit are:

```
dokan.lib           size:  5500 bytes         sha1: 96cf91e81e8c983aea04fcdd1d9e53ed699d6c7c
dokan.dll           size: 53488 bytes         sha1: df3f5323f0a4e31651dca6c561f446a6256aa0c2
```

## Troubleshooting: `C source files not allowed when not using cgo or SWIG: bridge.c`

This is caused by cgo not being enabled (e.g. 64 bit windows go toolchain and GOARCH=386).
Fix this by setting CGOENABLED=1 and recheck `go env`.

## Troubleshooting: `undefined reference to `_imp__DokanMain@8'`

32-bit build and dokan.lib is missing? Make it available!

## Try it out like kbfsfuse:

```./kbfsdokan.exe -localuser <user> M:/```

## From an another console

```
M:
cd \public
cd <user>
dir
mkdir foo
notepad bar.txt
```

## Issue: symbolic links only inside the current directory

This is quite simple to fix, the only issue is to escape unix paths properly and safely
to avoid referencing something an user might not want to reference.
