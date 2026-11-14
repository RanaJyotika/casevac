package com.casevacmobile.transfer

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/** Registers the CASEVAC Bluetooth handover module (see CasevacBluetoothModule). */
class CasevacTransferPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == CasevacBluetoothModule.NAME) CasevacBluetoothModule(reactContext) else null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider =
    ReactModuleInfoProvider {
      mapOf(
        CasevacBluetoothModule.NAME to
          ReactModuleInfo(
            CasevacBluetoothModule.NAME,
            CasevacBluetoothModule::class.java.name,
            false, // canOverrideExistingModule
            false, // needsEagerInit
            false, // isCxxModule
            false, // isTurboModule (legacy module, works through the interop layer)
          ),
      )
    }
}
