# TODO make CLANG_HOME work on other platforms
build() {
    GOPATH=`pwd`/../go
    CLANG_HOME=$ANDROID_HOME/ndk-bundle/toolchains/llvm/prebuilt/darwin-x86_64/bin
    ARCH=$1

    env \
    GOOS=$2 \
    GOARCH=$3 \
    CGO_ENABLED=1 \
    CC=$CLANG_HOME/$ARCH-clang \
    CXX=$CLANG_HOME/$ARCH-clang++ \
    go tool cgo -exportheader "c-headers/keybaselib-$3.h" ../../../go/bind/keybase.go
}

# Very hacky for now
# build(clang-toolchain-name GOOS GOARCH)
mkdir c-headers
build i686-linux-android16 android 386
build armv7a-linux-androideabi16 android arm
build aarch64-linux-android21 android arm64
rm -r _obj
