const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
if (process.env.COMRADIA_ATLAS === '1') {
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (
      moduleName === '@/services/backend' ||
      moduleName === path.join(__dirname, 'services/backend')
    ) {
      return { type: 'sourceFile', filePath: path.join(__dirname, 'tests/atlas/backend.web.ts') };
    }
    if (moduleName === '@/features/profile/pick-photo')
      return {
        type: 'sourceFile',
        filePath: path.join(__dirname, 'tests/atlas/pick-photo.web.ts'),
      };
    return context.resolveRequest(context, moduleName, platform);
  };
}
module.exports = config;
