const { withAppBuildGradle } = require('@expo/config-plugins');

function quoteGroovy(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

module.exports = function withRelayAndroidSigning(config) {
    return withAppBuildGradle(config, (mod) => {
        const required = process.env.RELAYID_REQUIRE_SIGNING === 'true';
        const values = {
            path: process.env.RELAYID_ANDROID_KEYSTORE_PATH,
            storePassword: process.env.RELAYID_ANDROID_KEYSTORE_PASSWORD,
            alias: process.env.RELAYID_ANDROID_KEY_ALIAS,
            keyPassword: process.env.RELAYID_ANDROID_KEY_PASSWORD,
        };

        const signingConfigured = Object.values(values).every((value) => value);
        if (!signingConfigured) {
            if (required) {
                throw new Error('RelayId release signing requires the Android keystore environment variables.');
            }

            mod.modResults.contents = mod.modResults.contents
                .replace(/    signingConfigs \{[\s\S]*?    \}\n    buildTypes \{/m, '    signingConfigs {\n        debug {\n            storeFile file(\'debug.keystore\')\n            storePassword \'android\'\n            keyAlias \'androiddebugkey\'\n            keyPassword \'android\'\n        }\n    }\n    buildTypes {')
                .replace(/            signingConfig signingConfigs\.release\n/, '');
            return mod;
        }

        const signingConfig = `        release {\n            storeFile file("${quoteGroovy(values.path)}")\n            storePassword "${quoteGroovy(values.storePassword)}"\n            keyAlias "${quoteGroovy(values.alias)}"\n            keyPassword "${quoteGroovy(values.keyPassword)}"\n        }\n`;
        mod.modResults.contents = mod.modResults.contents
            .replace(/    signingConfigs \{[\s\S]*?    \}\n    buildTypes \{/m, `    signingConfigs {\n${signingConfig}    }\n    buildTypes {`);
        mod.modResults.contents = mod.modResults.contents.replace(
            '        release {\n            def enableShrinkResources',
            '        release {\n            signingConfig signingConfigs.release\n            def enableShrinkResources',
        );
        return mod;
    });
};
