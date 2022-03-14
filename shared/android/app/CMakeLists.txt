cmake_minimum_required(VERSION 3.9.0)

set (PACKAGE_NAME "gojsi")
set (BUILD_DIR ${CMAKE_SOURCE_DIR}/build)

include_directories(
        "${NODE_MODULES_DIR}/react-native/React"
        "${NODE_MODULES_DIR}/react-native/React/Base"
        "${NODE_MODULES_DIR}/react-native/ReactCommon/jsi"
)

# if(${REACT_NATIVE_VERSION} LESS 66)
#         file(
#                 TO_CMAKE_PATH 
#                 "${NODE_MODULES_DIR}/react-native/ReactCommon/jsi/jsi/jsi.cpp"
#                 INCLUDE_JSI_CPP
#         )
# endif()

add_library(gojsi  # <-- Library name
        SHARED
        src/main/cpp/cpp-adapter.cpp
        # ${INCLUDE_JSI_CPP} # only on older RN versions
)

set_target_properties(
        gojsi PROPERTIES
        CXX_STANDARD 17
        CXX_EXTENSIONS OFF
        POSITION_INDEPENDENT_CODE ON
)

file (GLOB LIBRN_DIR "${PREBUILT_DIR}/${ANDROID_ABI}")

find_library(
        log-lib
        log
)
find_library(
        REACT_NATIVE_JNI_LIB
        reactnativejni
        PATHS ${LIBRN_DIR}
        NO_CMAKE_FIND_ROOT_PATH
)
# if(${REACT_NATIVE_VERSION} LESS 66)
#         # JSI lib didn't exist on RN 0.65 and before. Simply omit it.
#         set (JSI_LIB "")
# else()
        # RN 0.66 distributes libjsi.so, can be used instead of compiling jsi.cpp manually.
        find_library(
                JSI_LIB
                jsi
                PATHS ${LIBRN_DIR}
                NO_CMAKE_FIND_ROOT_PATH
        )
# endif()

target_link_libraries(
        gojsi
        ${log-lib}
        ${JSI_LIB}
        ${REACT_NATIVE_JNI_LIB}
        android
)
