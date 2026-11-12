if(NOT TARGET hermes-engine::hermesvm)
add_library(hermes-engine::hermesvm SHARED IMPORTED)
set_target_properties(hermes-engine::hermesvm PROPERTIES
    IMPORTED_LOCATION "C:/Users/MY PC/.gradle/caches/9.4.1/transforms/8f3f5af116c21d0e5a408aba63fc47c2/transformed/hermes-android-260318099.0.5-debug/prefab/modules/hermesvm/libs/android.arm64-v8a/libhermesvm.so"
    INTERFACE_INCLUDE_DIRECTORIES "C:/Users/MY PC/.gradle/caches/9.4.1/transforms/8f3f5af116c21d0e5a408aba63fc47c2/transformed/hermes-android-260318099.0.5-debug/prefab/modules/hermesvm/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

