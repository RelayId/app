package com.relayid.wear

import android.content.Context
import com.google.android.gms.tasks.Tasks
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

    }

    companion object {
        const val PREFERENCES = "relayid_wear"
        const val STATE_KEY = "state"
        const val STATE_PATH = "/relayid/state"
        const val PAYLOAD_KEY = "payload"
        const val REQUEST_PATH = "/relayid/request-code"
        const val RESPONSE_PATH = "/relayid/code-response"
        const val WATCH_CAPABILITY = "relayid_watch_app"
    }
}
