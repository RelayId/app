package com.relayid.wear

import android.content.Context
import com.google.android.gms.wearable.PutDataMapRequest
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
    }

    companion object {
        const val PREFERENCES = "relayid_wear"
        const val STATE_KEY = "state"
        const val STATE_PATH = "/relayid/state"
        const val PAYLOAD_KEY = "payload"
        const val REQUEST_PATH = "/relayid/request-code"
    }
}
