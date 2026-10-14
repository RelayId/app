const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withRelayAndroidDebugBundle(config) {
    return withAppBuildGradle(config, (mod) => {
        mod.modResults.contents = mod.modResults.contents.replace(
            '    // debuggableVariants = ["liteDebug", "prodDebug"]\n',
            '    debuggableVariants = []\n',
        );
        return mod;
    });
};
