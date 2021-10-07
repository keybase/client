add_lite_ai_toolkit_shared_library(${VERSION_STRING} ${SOVERSION_STRING})
add_lite_ai_toolkit_pre_custom_command()
if(${PLATFORM_NAME}  macos  ${PLATFORM_NAME}  linux)
    add_lite_ai_toolkit_post_custom_command()
endif()




















