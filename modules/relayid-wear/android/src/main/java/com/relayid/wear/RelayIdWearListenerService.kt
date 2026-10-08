package com.relayid.wear

import android.content.Context
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService
import org.json.JSONArray
import org.json.JSONObject

class RelayIdWearListenerService : WearableListenerService() {
    override fun onMessageReceived(event: MessageEvent) {
        if (event.path != RelayIdWearModule.REQUEST_PATH) return

        val relayId = event.data.toString(Charsets.UTF_8)
        if (relayId.isBlank()) return

        val preferences = getSharedPreferences(RelayIdWearModule.PREFERENCES, Context.MODE_PRIVATE)
        val requests = runCatching {
            JSONArray(preferences.getString(RelayIdWearModule.REQUESTS_KEY, "[]") ?: "[]")
        }.getOrElse { JSONArray() }
        requests.put(JSONObject().put("relay_id", relayId))
        preferences.edit().putString(RelayIdWearModule.REQUESTS_KEY, requests.toString()).apply()
    }
}
