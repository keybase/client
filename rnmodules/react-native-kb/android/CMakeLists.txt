project(cpp)
cmake_minimum_required(VERSION 3.4.1)

set (CMAKE_VERBOSE_MAKEFILE ON)
set (CMAKE_CXX_STANDARD 20)
set (NODE_MODULES_DIR "${CMAKE_SOURCE_DIR}/../..")
set (KB_JSI_INBOUND_BINARY_MODE "0" CACHE STRING "0=current Uint8Array, 1=MutableBuffer ArrayBuffer, 2=MutableBuffer wrapped Uint8Array")
set_property(CACHE KB_JSI_INBOUND_BINARY_MODE PROPERTY STRINGS "0" "1" "2")
option(KB_JSI_OUTBOUND_TYPED_ARRAY_FASTPATH "Check Uint8Array before object property enumeration" OFF)
option(KB_JSI_PERF "Install benchmark-only JSI performance hooks" OFF)

if(KB_JSI_OUTBOUND_TYPED_ARRAY_FASTPATH)
  set(KB_JSI_OUTBOUND_TYPED_ARRAY_FASTPATH_VALUE 1)
else()
  set(KB_JSI_OUTBOUND_TYPED_ARRAY_FASTPATH_VALUE 0)
endif()

add_library(cpp
            SHARED
            ../cpp/react-native-kb.cpp
            cpp-adapter.cpp
)

message(INFO "params: ${NODE_MODULES_DIR}")

# Specifies a path to native header files.
include_directories(
   ../cpp
   "${NODE_MODULES_DIR}/msgpack-cxx-7.0.0/include"
)

set_target_properties(
        cpp PROPERTIES
        CXX_STANDARD 20
        CXX_EXTENSIONS OFF
        POSITION_INDEPENDENT_CODE ON
)

target_compile_definitions(
        cpp
        PRIVATE
        MSGPACK_NO_BOOST
        KB_JSI_INBOUND_BINARY_MODE=${KB_JSI_INBOUND_BINARY_MODE}
        KB_JSI_OUTBOUND_TYPED_ARRAY_FASTPATH=${KB_JSI_OUTBOUND_TYPED_ARRAY_FASTPATH_VALUE}
)

if(KB_JSI_PERF)
  target_compile_definitions(cpp PRIVATE KB_JSI_PERF=1)
endif()

find_package(ReactAndroid REQUIRED CONFIG)
find_package(fbjni REQUIRED CONFIG)
find_library(LOG_LIB log)

if(${USE_HERMES})
  set(JSEXECUTOR_LIB ReactAndroid::hermes_executor)
else()
  set(JSEXECUTOR_LIB ReactAndroid::jscexecutor)
endif()

target_link_options(cpp PRIVATE "-Wl,-z,max-page-size=16384")

target_link_libraries(
        cpp
        ${LOG_LIB}
        fbjni::fbjni
        ReactAndroid::jsi
        ReactAndroid::reactnative
        android
)
