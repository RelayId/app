package com.relayid.wear

import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable

class RelayIdWearModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("RelayIdWear")

        Function("publishState") { payload: String ->
            val context = requireNotNull(appContext.reactContext)
            val request = PutDataMapRequest.create(STATE_PATH)
            request.dataMap.putString(PAYLOAD_KEY, payload)
            Wearable.getDataClient(context)
                .putDataItem(request.asPutDataRequest().setUrgent())
        }

        Function("consumeRequests") {
            val context = requireNotNull(appContext.reactContext)
            val preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
            val requests = preferences.getString(REQUESTS_KEY, "[]") ?: "[]"
            preferences.edit().putString(REQUESTS_KEY, "[]").apply()
            return@Function requests
        }
    }

    companion object {
        const val PREFERENCES = "relayid_wear"
        const val REQUESTS_KEY = "requests"
        const val STATE_PATH = "/relayid/state"
        const val PAYLOAD_KEY = "payload"
        const val REQUEST_PATH = "/relayid/request-code"
    }
}
