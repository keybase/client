project(cpp)
cmake_minimum_required(VERSION 3.4.1)

find_package(ReactAndroid REQUIRED CONFIG)
find_package(fbjni REQUIRED CONFIG)

set (CMAKE_VERBOSE_MAKEFILE ON)
set (CMAKE_CXX_STANDARD 17)
set (NODE_MODULES_DIR "${CMAKE_SOURCE_DIR}/../../../shared/node_modules")

add_library(cpp
            SHARED
            ../cpp/react-native-kb.cpp
            cpp-adapter.cpp
)

message(INFO "params: ${NODE_MODULES_DIR}")

# Specifies a path to native header files.
include_directories(
   ../cpp
   "${NODE_MODULES_DIR}/react-native/React"
   "${NODE_MODULES_DIR}/react-native/React/Base"
   "${NODE_MODULES_DIR}/react-native/ReactCommon/jsi"
   "${NODE_MODULES_DIR}/react-native/ReactCommon/callinvoker"
   "${NODE_MODULES_DIR}/react-native/ReactAndroid/src/main/jni/react/turbomodule"
   "${NODE_MODULES_DIR}/msgpack-cxx-4.1.1/include"
)

set_target_properties(
        cpp PROPERTIES
        CXX_STANDARD 17
        CXX_EXTENSIONS OFF
        POSITION_INDEPENDENT_CODE ON
)

# target_include_directories(
#     cpp
#     PRIVATE
#     ../cpp
    # "${REACT_NATIVE_DIR}/React"
    # "${REACT_NATIVE_DIR}/React/Base"
    # "${REACT_NATIVE_DIR}/ReactAndroid/src/main/jni"
    # "${REACT_NATIVE_DIR}/ReactAndroid/src/main/jni/react/turbomodule"
    # "${REACT_NATIVE_DIR}/ReactAndroid/src/main/java/com/facebook/react/turbomodule/core/jni"
    # "${REACT_NATIVE_DIR}/ReactCommon"
    # "${REACT_NATIVE_DIR}/ReactCommon/callinvoker"
    # "${REACT_NATIVE_DIR}/ReactCommon/jsi"
    # ${libfbjni_include_DIRS}
# )

add_definitions(-DMSGPACK_NO_BOOST)

file (GLOB LIBRN_DIR "${BUILD_DIR}/react-native-0*/jni/${ANDROID_ABI}")

find_library(LOG_LIB log)
find_library(
        FBJNI_LIB
        fbjni
        PATHS ${LIBRN_DIR}
        NO_DEFAULT_PATH
        NO_CMAKE_FIND_ROOT_PATH
)
find_library(
        JSI_LIB
        jsi
        PATHS ${LIBRN_DIR}
        NO_CMAKE_FIND_ROOT_PATH
)
find_library(
        REACT_NATIVE_JNI_LIB
        reactnativejni
        PATHS ${LIBRN_DIR}
        NO_CMAKE_FIND_ROOT_PATH
)

target_link_libraries(
        cpp
        ${LOG_LIB}
        # ${FBJNI_LIB}
        # ${JSI_LIB}
        # ${REACT_NATIVE_JNI_LIB}
        fbjni::fbjni
        ReactAndroid::jsi
        ReactAndroid::reactnativejni
        fbjni::fbjni
        android
)
