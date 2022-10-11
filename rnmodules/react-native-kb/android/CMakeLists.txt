cmake_minimum_required(VERSION 3.4.1)

set (PACKAGE_NAME "cpp")
set (CMAKE_VERBOSE_MAKEFILE ON)

set (CMAKE_CXX_FLAGS "-fexceptions -fno-omit-frame-pointer -frtti -Wno-sign-compare")
set (CMAKE_C_FLAGS_DEBUG "${CMAKE_C_FLAGS_DEBUG} -g")
set (CMAKE_CXX_FLAGS_DEBUG "${CMAKE_CXX_FLAGS_DEBUG} -g")
set (NODE_MODULES_DIR "${CMAKE_SOURCE_DIR}/../../../shared/node_modules")

if(${IS_NEW_ARCHITECTURE_ENABLED})
    if(${CLIENT_SIDE_BUILD})
        set (RN_SO_DIR "${CMAKE_SOURCE_DIR}/../../../android/app/build/react-ndk/exported")
        set (FBJNI_HEADERS_DIR "${CMAKE_SOURCE_DIR}/../../react-native/ReactAndroid/src/main/jni/first-party/fbjni/headers")
    else()
        set (RN_SO_DIR "${CMAKE_SOURCE_DIR}/../${PLAYGROUND_APP_NAME}/android/app/build/react-ndk/exported")
        set (FBJNI_HEADERS_DIR "${CMAKE_SOURCE_DIR}/../${PLAYGROUND_APP_NAME}/node_modules/react-native/ReactAndroid/src/main/jni/first-party/fbjni/headers")
    endif()
else()
    set (RN_SO_DIR ${NODE_MODULES_DIR}/react-native/ReactAndroid/src/main/jni/first-party/react/jni)
    set (FBJNI_HEADERS_DIR "${NODE_MODULES_DIR}/react-native/ReactAndroid/src/main/jni/first-party/fbjni/headers")
endif()


add_library(${PACKAGE_NAME}
            SHARED
            ../cpp/rpc.cpp
            cpp-adapter.cpp
)

set_target_properties(
        ${PACKAGE_NAME} PROPERTIES
        CXX_STANDARD 17
        CXX_EXTENSIONS OFF
        POSITION_INDEPENDENT_CODE ON
)
file (GLOB LIBFBJNI_INCLUDE_DIR ${FBJNI_HEADERS_DIR})

# Specifies a path to native header files.
include_directories(
    ../cpp
    "${LIBFBJNI_INCLUDE_DIR}"
    "${NODE_MODULES_DIR}/react-native/React"
    "${NODE_MODULES_DIR}/react-native/React/Base"
    "${NODE_MODULES_DIR}/react-native/ReactCommon/jsi"
    "${NODE_MODULES_DIR}/react-native/React"
    "${NODE_MODULES_DIR}/react-native/React/Base"
    "${NODE_MODULES_DIR}/react-native/ReactCommon"
    "${NODE_MODULES_DIR}/react-native/ReactCommon/jsi"
    "${NODE_MODULES_DIR}/react-native/ReactCommon/callinvoker"
    "${NODE_MODULES_DIR}/react-native/ReactAndroid/src/main/java/com/facebook/react/turbomodule/core/jni"
    "${NODE_MODULES_DIR}/react-native/ReactCommon/turbomodule/core"
    "${NODE_MODULES_DIR}/react-native/ReactCommon/turbomodule"
    "${NODE_MODULES_DIR}/msgpack-cxx-4.1.1/include"
)

file (GLOB LIBRN_DIR "${PREBUILT_DIR}/${ANDROID_ABI}")
find_library( log-lib log)
find_library(
        REACT_NATIVE_JNI_LIB
        reactnativejni
        PATHS ${LIBRN_DIR}
        NO_CMAKE_FIND_ROOT_PATH
)
find_library(
        JSI_LIB
        jsi
        PATHS ${LIBRN_DIR}
        NO_CMAKE_FIND_ROOT_PATH
)

find_library(
        FBJNI_LIB
        fbjni
        PATHS ${LIBRN_DIR}
        NO_CMAKE_FIND_ROOT_PATH
)

add_definitions(-DMSGPACK_NO_BOOST)

target_link_libraries(
        ${PACKAGE_NAME}
        ${FBJNI_LIB}
        ${log-lib}
        ${JSI_LIB}
        ${REACT_NATIVE_JNI_LIB}
        android
)
