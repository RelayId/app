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

        if (Object.values(values).some((value) => !value)) {
            if (required) {
                throw new Error('RelayId release signing requires the Android keystore environment variables.');
            }
            return mod;
        }

        const signingConfig = `        release {\n            storeFile file("${quoteGroovy(values.path)}")\n            storePassword "${quoteGroovy(values.storePassword)}"\n            keyAlias "${quoteGroovy(values.alias)}"\n            keyPassword "${quoteGroovy(values.keyPassword)}"\n        }\n`;
        if (!mod.modResults.contents.includes('storeFile file("')) {
            mod.modResults.contents = mod.modResults.contents.replace(
                '    signingConfigs {\n',
                `    signingConfigs {\n${signingConfig}`,
            );
        }
        mod.modResults.contents = mod.modResults.contents.replace(
            'signingConfig signingConfigs.debug\n            def enableShrinkResources',
            'signingConfig signingConfigs.release\n            def enableShrinkResources',
        );
        return mod;
    });
};
