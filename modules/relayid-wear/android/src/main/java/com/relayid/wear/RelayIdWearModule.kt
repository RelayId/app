package com.relayid.wear

import android.content.Context
import android.net.Uri
import android.util.Log
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import com.google.android.gms.tasks.Tasks
import com.google.android.gms.wearable.Asset
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.CapabilityClient
import com.google.android.gms.wearable.Wearable
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class RelayIdWearModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("RelayIdWear")

        Function("publishState") { payload: String ->
            val context = requireNotNull(appContext.reactContext)
            context
                .getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
                .edit()
                .putString(STATE_KEY, payload)
                .apply()
            val request = PutDataMapRequest.create(STATE_PATH)
            request.dataMap.putString(PAYLOAD_KEY, payload)
            Wearable.getDataClient(context)
                .putDataItem(request.asPutDataRequest().setUrgent())
        }

        Function("setWatchCredentials") { payload: String ->
            WatchCredentialStore.write(requireNotNull(appContext.reactContext), payload)
        }

        AsyncFunction("getConnectedWatchCount") {
            val context = requireNotNull(appContext.reactContext)
            Tasks.await(Wearable.getNodeClient(context).connectedNodes).count { it.isNearby }
        }

        AsyncFunction("getWatchStatus") {
            val context = requireNotNull(appContext.reactContext)
            val connected = Tasks.await(Wearable.getNodeClient(context).connectedNodes)
            val installed = Tasks.await(
                Wearable.getCapabilityClient(context).getCapability(
                    WATCH_CAPABILITY,
                    CapabilityClient.FILTER_ALL,
                ),
            ).nodes.map { it.id }.toSet()
            mapOf(
                "connected" to connected.size,
                "installed" to connected.count { it.id in installed },
            )
        }

        AsyncFunction("getConnectedWatches") {
            val context = requireNotNull(appContext.reactContext)
            Tasks.await(Wearable.getNodeClient(context).connectedNodes).map { node ->
                mapOf(
                    "id" to node.id,
                    "displayName" to node.displayName,
                    "nearby" to node.isNearby,
                )
            }
        }

        AsyncFunction("getWatchInstallerStatus") { targetNodeId: String ->
            val context = requireNotNull(appContext.reactContext)
            context
                .getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
                .getString(INSTALL_STATUS_PREFIX + targetNodeId, null)
        }

        AsyncFunction("installWatchArtifact") { url: String, targetNodeId: String ->
            Log.i("RelayIdWear", "Preparing Watch installer for node=$targetNodeId url=$url")
            require(url.startsWith("https://")) { "Watch update URL must use HTTPS" }
            val context = requireNotNull(appContext.reactContext)
            val connectedNodes = Tasks.await(Wearable.getNodeClient(context).connectedNodes)
            Log.i("RelayIdWear", "Connected nodes=${connectedNodes.joinToString { "${it.id}:${it.displayName}" }}")
            check(connectedNodes.any { it.id == targetNodeId }) {
                "Selected Wear OS watch is no longer connected"
            }

            val apk = File(context.cacheDir, "relayid-watch.apk")
            val temporary = File(context.cacheDir, "relayid-watch.apk.part")
            temporary.delete()
            val connection = (URL(url).openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 15_000
                readTimeout = 30_000
                instanceFollowRedirects = true
            }
            try {
                check(connection.responseCode in 200..299) { "Watch download failed (${connection.responseCode})" }
                Log.i("RelayIdWear", "Watch APK response=${connection.responseCode} type=${connection.contentType} length=${connection.contentLengthLong}")
                check(connection.contentType?.startsWith("application/vnd.android.package-archive") == true) {
                    "Watch download was not an APK"
                }
                connection.inputStream.use { input -> temporary.outputStream().use { output -> input.copyTo(output) } }
            } finally {
                connection.disconnect()
            }
            check(temporary.length() > 0) { "Watch download was empty" }
            check(!apk.exists() || apk.delete()) { "Could not replace the watch download" }
            check(temporary.renameTo(apk)) { "Could not save the watch download" }

            val request = PutDataMapRequest.create(INSTALL_PATH)
            request.dataMap.putAsset(APK_KEY, Asset.createFromUri(Uri.fromFile(apk)))
            request.dataMap.putLong(INSTALL_REQUEST_KEY, System.currentTimeMillis())
            request.dataMap.putString(TARGET_NODE_KEY, targetNodeId)
            context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
                .edit()
                .remove(INSTALL_STATUS_PREFIX + targetNodeId)
                .apply()
            val result = Tasks.await(
                Wearable.getDataClient(context).putDataItem(
                    request.asPutDataRequest().setUrgent(),
                ),
            )
            Log.i("RelayIdWear", "Watch installer DataItem delivered uri=${result.uri} target=$targetNodeId bytes=${apk.length()}")
            true
        }
    }

    companion object {
        const val PREFERENCES = "relayid_wear"
        const val STATE_KEY = "state"
        const val STATE_PATH = "/relayid/state"
        const val PAYLOAD_KEY = "payload"
        const val REQUEST_PATH = "/relayid/request-code"
        const val RESPONSE_PATH = "/relayid/code-response"
        const val WATCH_CAPABILITY = "relayid_watch_app"
        const val INSTALL_PATH = "/relayid/install-watch"
        const val APK_KEY = "apk"
        const val INSTALL_REQUEST_KEY = "install_request"
        const val TARGET_NODE_KEY = "target_node_id"
        const val INSTALL_STATUS_PREFIX = "install_status_"
        const val INSTALL_STATUS_PATH = "/relayid/install-watch-status"
    }
}
