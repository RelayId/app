package com.relayid.wear

import android.content.Context
import android.util.Log
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import kotlin.concurrent.thread

import com.google.android.gms.tasks.Tasks
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import com.google.android.gms.wearable.WearableListenerService
import org.json.JSONObject

class RelayIdWearListenerService : WearableListenerService() {
    override fun onDataChanged(events: DataEventBuffer) {
        events.use { buffer ->
            buffer.forEach { event ->
                if (event.type != DataEvent.TYPE_CHANGED || event.dataItem.uri.path != RelayIdWearModule.INSTALL_PATH) return@forEach
                val asset = DataMapItem.fromDataItem(event.dataItem).dataMap.getAsset(RelayIdWearModule.APK_KEY)
                    ?: return@forEach
                thread(name = "relayid-watch-install") { receiveAndInstall(asset) }
            }
        }
    }

    private fun receiveAndInstall(asset: com.google.android.gms.wearable.Asset) {
        runCatching {
            val apk = File(cacheDir, "relayid-watch.apk")
            val response = Tasks.await(Wearable.getDataClient(this).getFdForAsset(asset))
            response.getInputStream().use { input ->
                apk.outputStream().use { output -> input.copyTo(output) }
            }
            val uri = androidx.core.content.FileProvider.getUriForFile(
                this,
                "com.relayid.app.relayid-files",
                apk,
            )
            startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION)
            })
        }.onFailure { error -> Log.e("RelayIdWear", "watch installation failed", error) }
    }

    override fun onMessageReceived(event: MessageEvent) {
        if (event.path == RelayIdWearModule.INSTALL_STATUS_PATH) {
            getSharedPreferences(RelayIdWearModule.PREFERENCES, Context.MODE_PRIVATE)
                .edit()
                .putString(RelayIdWearModule.INSTALL_STATUS_PREFIX + event.sourceNodeId, event.data.toString(Charsets.UTF_8))
                .apply()
            return
        }
        if (event.path != RelayIdWearModule.REQUEST_PATH) return

        val relayId = event.data.toString(Charsets.UTF_8)
        if (relayId.isBlank()) return

        thread(name = "relayid-watch-code") {
            val preferences = getSharedPreferences(RelayIdWearModule.PREFERENCES, Context.MODE_PRIVATE)
            val state = preferences.getString(RelayIdWearModule.STATE_KEY, null) ?: run {
                sendError(event.sourceNodeId, relayId, "Unlock RelayId on your phone.")
                return@thread
            }
            val credentials = WatchCredentialStore.read(this) ?: run {
                sendError(event.sourceNodeId, relayId, "Watch authorization is not ready.")
                return@thread
            }
            requestCode(event.sourceNodeId, state, credentials, relayId)
        }
    }

    private fun requestCode(nodeId: String, payload: String, credentialsPayload: String, relayId: String) {
        runCatching {
            val root = JSONObject(payload)
            val relays = root.optJSONArray("relays") ?: return
            val relay = (0 until relays.length())
                .map { relays.getJSONObject(it) }
                .firstOrNull { it.optString("id") == relayId }
                ?: return
            val origin = relay.optString("origin").ifBlank {
                relay.optString("host").takeIf { it.isNotBlank() }?.let { "https://$it" }.orEmpty()
            }
            val token = JSONObject(credentialsPayload).optString(relayId)
            if (origin.isBlank() || token.isBlank()) return

            val connection = (URL(origin.trimEnd('/') + "/api/watch/codes").openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 10_000
                readTimeout = 10_000
                instanceFollowRedirects = false
                doOutput = true
                setRequestProperty("Accept", "application/json")
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Authorization", "RelayWatch $token")
            }
            try {
                connection.outputStream.use { it.write("{}".toByteArray(Charsets.UTF_8)) }
                if (connection.responseCode !in 200..299) {
                    val message = if (connection.responseCode == 401) {
                        "Unlock RelayId on your phone to refresh Watch access."
                    } else {
                        "Relay is unavailable right now."
                    }
                    sendError(nodeId, relayId, message)
                    return
                }

                val responseBody = connection.inputStream.bufferedReader().use { it.readText() }
                val data = JSONObject(responseBody).getJSONObject("data")
                val responsePayload = JSONObject()
                    .put("relay_id", relayId)
                    .put("code", data.getString("code"))
                    .put("groups", data.getInt("groups"))
                    .put(
                        "expires_in",
                        (Instant.parse(data.getString("expires_at")).epochSecond - Instant.now().epochSecond)
                            .toInt()
                            .coerceAtLeast(0),
                    )
                Wearable.getMessageClient(this).sendMessage(
                    nodeId,
                    RelayIdWearModule.RESPONSE_PATH,
                    responsePayload.toString().toByteArray(Charsets.UTF_8),
                )
            } finally {
                connection.disconnect()
            }
        }

    }

    private fun sendError(nodeId: String, relayId: String, message: String) {
        Wearable.getMessageClient(this).sendMessage(
            nodeId,
            RelayIdWearModule.RESPONSE_PATH,
            JSONObject()
                .put("relay_id", relayId)
                .put("error", message)
                .toString()
                .toByteArray(Charsets.UTF_8),
        )
    }

    private fun publishState(payload: String) {
        getSharedPreferences(RelayIdWearModule.PREFERENCES, Context.MODE_PRIVATE)
            .edit()
            .putString(RelayIdWearModule.STATE_KEY, payload)
            .apply()
        val request = PutDataMapRequest.create(RelayIdWearModule.STATE_PATH)
        request.dataMap.putString(RelayIdWearModule.PAYLOAD_KEY, payload)
        Wearable.getDataClient(this).putDataItem(request.asPutDataRequest().setUrgent())
    }
}
