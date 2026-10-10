package com.relayid.wear

import android.content.Context
import android.util.Base64
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

internal object WatchCredentialStore {
    private const val KEYSTORE = "AndroidKeyStore"
    private const val KEY_ALIAS = "relayid.watch.credentials"
    private const val PREFS = "relayid_wear"
    private const val VALUE_KEY = "watch_credentials_encrypted"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"

    fun write(context: Context, value: String) {
        KeyStore.getInstance(KEYSTORE).apply {
            load(null)
            if (containsAlias(KEY_ALIAS)) deleteEntry(KEY_ALIAS)
        }
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val encrypted = Base64.encodeToString(cipher.iv + cipher.doFinal(value.toByteArray(StandardCharsets.UTF_8)), Base64.NO_WRAP)
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(VALUE_KEY, encrypted).apply()
    }

    fun read(context: Context): String? {
        val encoded = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(VALUE_KEY, null) ?: return null
        return runCatching {
            val combined = Base64.decode(encoded, Base64.NO_WRAP)
            val iv = combined.copyOfRange(0, 12)
            val ciphertext = combined.copyOfRange(12, combined.size)
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, iv))
            String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8)
        }.getOrNull()
    }

    private fun key(): SecretKey {
        val store = KeyStore.getInstance(KEYSTORE).apply { load(null) }
        val existing = store.getKey(KEY_ALIAS, null)
        if (existing is SecretKey) return existing

        val generator = KeyGenerator.getInstance("AES", KEYSTORE)
        generator.init(android.security.keystore.KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            android.security.keystore.KeyProperties.PURPOSE_ENCRYPT or android.security.keystore.KeyProperties.PURPOSE_DECRYPT,
        ).setBlockModes(android.security.keystore.KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(android.security.keystore.KeyProperties.ENCRYPTION_PADDING_NONE)
            .build())
        return generator.generateKey()
    }
}
