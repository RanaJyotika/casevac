if(NOT TARGET ReactAndroid::hermestooling)
add_library(ReactAndroid::hermestooling SHARED IMPORTED)
set_target_properties(ReactAndroid::hermestooling PROPERTIES
    IMPORTED_LOCATION "C:/Users/MY PC/.gradle/caches/9.4.1/transforms/73ec3f6a28ea02ef884b8a9b5a346e8c/transformed/react-android-0.88.1-debug/prefab/modules/hermestooling/libs/android.arm64-v8a/libhermestooling.so"
    INTERFACE_INCLUDE_DIRECTORIES "C:/Users/MY PC/.gradle/caches/9.4.1/transforms/73ec3f6a28ea02ef884b8a9b5a346e8c/transformed/react-android-0.88.1-debug/prefab/modules/hermestooling/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

if(NOT TARGET ReactAndroid::jsi)
add_library(ReactAndroid::jsi SHARED IMPORTED)
set_target_properties(ReactAndroid::jsi PROPERTIES
    IMPORTED_LOCATION "C:/Users/MY PC/.gradle/caches/9.4.1/transforms/73ec3f6a28ea02ef884b8a9b5a346e8c/transformed/react-android-0.88.1-debug/prefab/modules/jsi/libs/android.arm64-v8a/libjsi.so"
    INTERFACE_INCLUDE_DIRECTORIES "C:/Users/MY PC/.gradle/caches/9.4.1/transforms/73ec3f6a28ea02ef884b8a9b5a346e8c/transformed/react-android-0.88.1-debug/prefab/modules/jsi/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

if(NOT TARGET ReactAndroid::reactnative)
add_library(ReactAndroid::reactnative SHARED IMPORTED)
set_target_properties(ReactAndroid::reactnative PROPERTIES
    IMPORTED_LOCATION "C:/Users/MY PC/.gradle/caches/9.4.1/transforms/73ec3f6a28ea02ef884b8a9b5a346e8c/transformed/react-android-0.88.1-debug/prefab/modules/reactnative/libs/android.arm64-v8a/libreactnative.so"
    INTERFACE_INCLUDE_DIRECTORIES "C:/Users/MY PC/.gradle/caches/9.4.1/transforms/73ec3f6a28ea02ef884b8a9b5a346e8c/transformed/react-android-0.88.1-debug/prefab/modules/reactnative/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

