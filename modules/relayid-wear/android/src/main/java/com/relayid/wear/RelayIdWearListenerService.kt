package com.relayid.wear

import android.content.Context
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import kotlin.concurrent.thread

import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import com.google.android.gms.wearable.WearableListenerService
import org.json.JSONObject

class RelayIdWearListenerService : WearableListenerService() {
    override fun onMessageReceived(event: MessageEvent) {
        if (event.path != RelayIdWearModule.REQUEST_PATH) return

        val relayId = event.data.toString(Charsets.UTF_8)
        if (relayId.isBlank()) return

        val preferences = getSharedPreferences(RelayIdWearModule.PREFERENCES, Context.MODE_PRIVATE)
        val state = preferences.getString(RelayIdWearModule.STATE_KEY, null)
        if (state == null) return

        thread(name = "relayid-watch-code") {
            requestCode(state, relayId)
        }
    }

    private fun requestCode(payload: String, relayId: String) {
        runCatching {
            val root = JSONObject(payload)
            val relays = root.optJSONArray("relays") ?: return
            val relay = (0 until relays.length())
                .map { relays.getJSONObject(it) }
                .firstOrNull { it.optString("id") == relayId }
                ?: return
            val origin = relay.optString("origin")
            val token = relay.optString("watch_token")
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
                if (connection.responseCode !in 200..299) return

                val response = connection.inputStream.bufferedReader().use { it.readText() }
                val data = JSONObject(response).getJSONObject("data")
                val updated = JSONObject(payload)
                    .put("code", data.getString("code"))
                    .put("groups", data.getInt("groups"))
                    .put(
                        "expires_in",
                        (Instant.parse(data.getString("expires_at")).epochSecond - Instant.now().epochSecond)
                            .toInt()
                            .coerceAtLeast(0),
                    )
                publishState(updated.toString())
            } finally {
                connection.disconnect()
            }
        }
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
