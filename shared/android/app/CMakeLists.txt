# For more information about using CMake with Android Studio, read the
# documentation: https://d.android.com/studio/projects/add-native-code.html

# Sets the minimum version of CMake required to build the native library.

cmake_minimum_required(VERSION 3.4.1)
set(CMAKE_SYSTEM_VERSION 25)

# Creates and names a library, sets it as either STATIC
# or SHARED, and provides the relative paths to its source code.
# You can define multiple libraries, and CMake builds them for you.
# Gradle automatically packages shared libraries with your APK.

execute_process(COMMAND sh -c "(`pwd`/scripts/ios-install-third-party.sh)"
                WORKING_DIRECTORY ${PROJECT_SOURCE_DIR}/../../node_modules/react-native
)
# Needed to locate double-conversion src correctly for folly includes
execute_process(COMMAND ln "-s" "${PROJECT_SOURCE_DIR}/../../node_modules/react-native/third-party/double-conversion-1.1.6/src" "${PROJECT_SOURCE_DIR}/../../node_modules/react-native/third-party/double-conversion-1.1.6/double-conversion")


include_directories(
    ../../node_modules/react-native/React
    ../../node_modules/react-native/React/Base
    ../../node_modules/react-native/ReactCommon
    ../../node_modules/react-native/third-party/folly-2018.10.22.00
    ../../node_modules/react-native/third-party/double-conversion-1.1.6
    ../../node_modules/react-native/third-party/boost_1_63_0
    ../../node_modules/react-native/third-party/glog-0.3.5/src
    ../../node_modules/react-native/ReactCommon/jsi
)

add_definitions(
    -DFOLLY_USE_LIBCPP=1
    -DFOLLY_NO_CONFIG=1
    -DFOLLY_HAVE_MEMRCHR=1
)

add_library( # Sets the name of the library.
        test_module_jni

        # Sets the library as a shared library.
        SHARED

        # Provides a relative path to your source file(s).
        ../../node_modules/react-native/ReactCommon/jsi/jsi
        ../../node_modules/react-native/ReactCommon/jsi/jsi/jsi.cpp
        ../c++/TestBinding.cpp
        )

target_link_libraries(test_module_jni
                      android
                      log)
