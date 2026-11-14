package com.casevacmobile.transfer

import android.annotation.SuppressLint
import android.app.Activity
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothServerSocket
import android.bluetooth.BluetoothSocket
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStream
import java.nio.charset.StandardCharsets
import java.security.SecureRandom
import java.util.UUID

/**
 * Casualty handover between two CASEVAC tablets over Classic Bluetooth
 * (RFCOMM), plus a secure random source for the JS crypto layer.
 *
 * Receiver: requestEnable → setDeviceName("JEEWAN|MED-…|name") →
 *   requestDiscoverable(120) → startServer. The sender's discovery lists only
 *   devices whose name starts with "JEEWAN|".
 * Sender: requestEnable → startDiscovery → connect(address). A secure RFCOMM
 *   connection to an unpaired tablet makes Android show its pairing dialog
 *   (the same 6-digit number on both screens) before any data moves.
 * Messages are UTF-8 lines; the JS layer encrypts and signs every payload, so
 * the link itself is never trusted.
 *
 * Events: CasevacBtDeviceFound {name, address}, CasevacBtDiscoveryFinished,
 *   CasevacBtConnected {name, address}, CasevacBtLine {line},
 *   CasevacBtDisconnected {reason}.
 */
@SuppressLint("MissingPermission") // runtime permissions are requested in JS first
class CasevacBluetoothModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  companion object {
    const val NAME = "CasevacBluetooth"
    /** Service UUID of the CASEVAC handover channel. */
    val SERVICE_UUID: UUID = UUID.fromString("6f3c1a52-8d2e-4b7a-9c41-2a5e0c9b7d13")
    private const val REQUEST_ENABLE = 47101
    private const val REQUEST_DISCOVERABLE = 47102
    private const val PREFS = "casevac.bluetooth"
    private const val PREF_ORIGINAL_NAME = "originalName"
  }

  private val random = SecureRandom()
  private var enablePromise: Promise? = null
  private var discoverablePromise: Promise? = null
  private var discoveryReceiver: BroadcastReceiver? = null
  private var serverSocket: BluetoothServerSocket? = null
  @Volatile private var socket: BluetoothSocket? = null
  @Volatile private var output: OutputStream? = null

  private val adapter: BluetoothAdapter?
    get() =
      (reactContext.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter

  private val activityListener =
    object : BaseActivityEventListener() {
      override fun onActivityResult(
        activity: Activity,
        requestCode: Int,
        resultCode: Int,
        data: Intent?,
      ) {
        when (requestCode) {
          REQUEST_ENABLE -> {
            enablePromise?.resolve(resultCode == Activity.RESULT_OK || adapter?.isEnabled == true)
            enablePromise = null
          }
          REQUEST_DISCOVERABLE -> {
            // The result code is the visibility duration; RESULT_CANCELED (0) = refused.
            discoverablePromise?.resolve(resultCode != Activity.RESULT_CANCELED)
            discoverablePromise = null
          }
        }
      }
    }

  init {
    reactContext.addActivityEventListener(activityListener)
  }

  override fun getName(): String = NAME

  private fun emit(event: String, body: Map<String, String?> = emptyMap()) {
    val map = Arguments.createMap()
    body.forEach { (k, v) -> if (v == null) map.putNull(k) else map.putString(k, v) }
    reactContext.emitDeviceEvent(event, map)
  }

  /* ------------------------------ Random ------------------------------ */

  @ReactMethod
  fun randomBytes(count: Int, promise: Promise) {
    if (count <= 0 || count > 4096) {
      promise.reject("E_RANGE", "count must be 1–4096")
      return
    }
    val bytes = ByteArray(count)
    random.nextBytes(bytes)
    promise.resolve(Base64.encodeToString(bytes, Base64.NO_WRAP))
  }

  /* ------------------------------ Adapter ------------------------------ */

  @ReactMethod
  fun isSupported(promise: Promise) = promise.resolve(adapter != null)

  @ReactMethod
  fun isEnabled(promise: Promise) = promise.resolve(adapter?.isEnabled == true)

  /** Shows Android's "Turn on Bluetooth?" dialog (apps cannot turn it on silently). */
  @ReactMethod
  fun requestEnable(promise: Promise) {
    val a = adapter ?: return promise.reject("E_UNSUPPORTED", "This tablet has no Bluetooth.")
    if (a.isEnabled) return promise.resolve(true)
    val activity = reactContext.currentActivity
      ?: return promise.reject("E_NO_ACTIVITY", "The app is not in the foreground.")
    enablePromise = promise
    activity.startActivityForResult(Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE), REQUEST_ENABLE)
  }

  /** Shows Android's "Make this tablet visible for N seconds?" dialog. */
  @ReactMethod
  fun requestDiscoverable(seconds: Int, promise: Promise) {
    val activity = reactContext.currentActivity
      ?: return promise.reject("E_NO_ACTIVITY", "The app is not in the foreground.")
    discoverablePromise = promise
    val intent =
      Intent(BluetoothAdapter.ACTION_REQUEST_DISCOVERABLE)
        .putExtra(BluetoothAdapter.EXTRA_DISCOVERABLE_DURATION, seconds.coerceIn(30, 300))
    activity.startActivityForResult(intent, REQUEST_DISCOVERABLE)
  }

  /** Renames this tablet (e.g. "JEEWAN|MED-00045|Maj Meera Iyer"); keeps the original. */
  @ReactMethod
  fun setDeviceName(name: String, promise: Promise) {
    val a = adapter ?: return promise.reject("E_UNSUPPORTED", "This tablet has no Bluetooth.")
    val prefs = reactContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val current = a.name ?: ""
    if (!prefs.contains(PREF_ORIGINAL_NAME) && !current.startsWith("JEEWAN|") && !current.startsWith("CASEVAC|")) {
      prefs.edit().putString(PREF_ORIGINAL_NAME, current).apply()
    }
    promise.resolve(a.setName(name.take(60)))
  }

  /** Puts back the name the tablet had before CASEVAC renamed it (also after a crash). */
  @ReactMethod
  fun restoreDeviceName(promise: Promise) {
    val a = adapter ?: return promise.resolve(false)
    val prefs = reactContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val original = prefs.getString(PREF_ORIGINAL_NAME, null) ?: return promise.resolve(false)
    val ok = a.setName(original)
    if (ok) prefs.edit().remove(PREF_ORIGINAL_NAME).apply()
    promise.resolve(ok)
  }

  /* ----------------------------- Discovery ----------------------------- */

  @ReactMethod
  fun startDiscovery(promise: Promise) {
    val a = adapter ?: return promise.reject("E_UNSUPPORTED", "This tablet has no Bluetooth.")
    stopDiscoveryReceiver()
    val receiver =
      object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
          when (intent.action) {
            BluetoothDevice.ACTION_FOUND, BluetoothDevice.ACTION_NAME_CHANGED -> {
              val device = deviceFrom(intent) ?: return
              val name = intent.getStringExtra(BluetoothDevice.EXTRA_NAME) ?: device.name
              emit("CasevacBtDeviceFound", mapOf("name" to name, "address" to device.address))
            }
            BluetoothAdapter.ACTION_DISCOVERY_FINISHED -> emit("CasevacBtDiscoveryFinished")
          }
        }
      }
    val filter =
      IntentFilter().apply {
        addAction(BluetoothDevice.ACTION_FOUND)
        addAction(BluetoothDevice.ACTION_NAME_CHANGED)
        addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED)
      }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      reactContext.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
    } else {
      reactContext.registerReceiver(receiver, filter)
    }
    discoveryReceiver = receiver
    if (a.isDiscovering) a.cancelDiscovery()
    promise.resolve(a.startDiscovery())
  }

  @ReactMethod
  fun cancelDiscovery(promise: Promise) {
    adapter?.let { if (it.isDiscovering) it.cancelDiscovery() }
    stopDiscoveryReceiver()
    promise.resolve(true)
  }

  private fun stopDiscoveryReceiver() {
    discoveryReceiver?.let {
      try {
        reactContext.unregisterReceiver(it)
      } catch (_: IllegalArgumentException) {
        // already unregistered
      }
    }
    discoveryReceiver = null
  }

  @Suppress("DEPRECATION")
  private fun deviceFrom(intent: Intent): BluetoothDevice? =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice::class.java)
    } else {
      intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
    }

  /* ---------------------------- Connection ---------------------------- */

  /** Receiver: waits for one sender. Resolves once listening. */
  @ReactMethod
  fun startServer(promise: Promise) {
    val a = adapter ?: return promise.reject("E_UNSUPPORTED", "This tablet has no Bluetooth.")
    closeAll()
    val server =
      try {
        a.listenUsingRfcommWithServiceRecord("CASEVAC handover", SERVICE_UUID)
      } catch (e: Exception) {
        return promise.reject("E_LISTEN", e.message ?: "Could not listen for Bluetooth.")
      }
    serverSocket = server
    Thread {
        try {
          val s = server.accept() // blocks until a sender connects (or the socket closes)
          try {
            server.close()
          } catch (_: Exception) {}
          serverSocket = null
          attach(s)
        } catch (_: Exception) {
          // closed by stopServer / disconnect
        }
      }
      .apply { isDaemon = true }
      .start()
    promise.resolve(true)
  }

  @ReactMethod
  fun stopServer(promise: Promise) {
    try {
      serverSocket?.close()
    } catch (_: Exception) {}
    serverSocket = null
    promise.resolve(true)
  }

  /** Sender: connects (Android pairs first if needed). */
  @ReactMethod
  fun connect(address: String, promise: Promise) {
    val a = adapter ?: return promise.reject("E_UNSUPPORTED", "This tablet has no Bluetooth.")
    if (!BluetoothAdapter.checkBluetoothAddress(address)) {
      return promise.reject("E_ADDRESS", "Invalid Bluetooth address.")
    }
    if (a.isDiscovering) a.cancelDiscovery()
    stopDiscoveryReceiver()
    Thread {
        try {
          val device = a.getRemoteDevice(address)
          val s = device.createRfcommSocketToServiceRecord(SERVICE_UUID)
          s.connect() // triggers the system pairing dialog on first contact
          attach(s)
          promise.resolve(Arguments.createMap().apply {
            putString("address", device.address)
            putString("name", device.name)
          })
        } catch (e: Exception) {
          promise.reject("E_CONNECT", e.message ?: "Could not connect to the tablet.")
        }
      }
      .apply { isDaemon = true }
      .start()
  }

  private fun attach(s: BluetoothSocket) {
    socket = s
    output = s.outputStream
    emit("CasevacBtConnected", mapOf("address" to s.remoteDevice.address, "name" to s.remoteDevice.name))
    Thread {
        try {
          val reader = BufferedReader(InputStreamReader(s.inputStream, StandardCharsets.UTF_8))
          while (true) {
            val line = reader.readLine() ?: break
            emit("CasevacBtLine", mapOf("line" to line))
          }
          emit("CasevacBtDisconnected", mapOf("reason" to "closed"))
        } catch (e: Exception) {
          emit("CasevacBtDisconnected", mapOf("reason" to (e.message ?: "lost")))
        } finally {
          if (socket === s) {
            socket = null
            output = null
          }
        }
      }
      .apply { isDaemon = true }
      .start()
  }

  @ReactMethod
  fun send(line: String, promise: Promise) {
    val out = output ?: return promise.reject("E_NOT_CONNECTED", "Not connected.")
    Thread {
        try {
          synchronized(out) {
            out.write((line.replace("\n", " ") + "\n").toByteArray(StandardCharsets.UTF_8))
            out.flush()
          }
          promise.resolve(true)
        } catch (e: Exception) {
          promise.reject("E_SEND", e.message ?: "Sending failed.")
        }
      }
      .apply { isDaemon = true }
      .start()
  }

  @ReactMethod
  fun disconnect(promise: Promise) {
    closeAll()
    promise.resolve(true)
  }

  private fun closeAll() {
    try {
      serverSocket?.close()
    } catch (_: Exception) {}
    serverSocket = null
    try {
      socket?.close()
    } catch (_: Exception) {}
    socket = null
    output = null
  }

  /* NativeEventEmitter needs these on Android. */
  @ReactMethod fun addListener(@Suppress("UNUSED_PARAMETER") eventName: String) {}

  @ReactMethod fun removeListeners(@Suppress("UNUSED_PARAMETER") count: Double) {}

  override fun invalidate() {
    stopDiscoveryReceiver()
    closeAll()
    reactContext.removeActivityEventListener(activityListener)
    super.invalidate()
  }
}
