project(cpp)
cmake_minimum_required(VERSION 3.4.1)

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
   "${NODE_MODULES_DIR}/msgpack-cxx-6.1.0/include"
)

set_target_properties(
        cpp PROPERTIES
        CXX_STANDARD 17
        CXX_EXTENSIONS OFF
        POSITION_INDEPENDENT_CODE ON
)

add_definitions(-DMSGPACK_NO_BOOST)

find_package(ReactAndroid REQUIRED CONFIG)
find_package(fbjni REQUIRED CONFIG)
find_library(LOG_LIB log)

if(${USE_HERMES})
  set(JSEXECUTOR_LIB ReactAndroid::hermes_executor)
else()
  set(JSEXECUTOR_LIB ReactAndroid::jscexecutor)
endif()

target_link_libraries(
        cpp
        ${LOG_LIB}
        fbjni::fbjni
        ReactAndroid::jsi
        ReactAndroid::turbomodulejsijni
        ReactAndroid::react_nativemodule_core
        android
)
