const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withRelayAndroidVersionCode(config) {
    const configuredVersionCode = process.env.RELAYID_ANDROID_VERSION_CODE;
    if (!configuredVersionCode) return config;

    if (!/^\d+$/.test(configuredVersionCode)) {
        throw new Error('RELAYID_ANDROID_VERSION_CODE must be a positive integer.');
    }

    return withAppBuildGradle(config, (mod) => {
        mod.modResults.contents = mod.modResults.contents.replace(
            /versionCode\s+\d+/,
            `versionCode ${configuredVersionCode}`,
        );
        return mod;
    });
};
