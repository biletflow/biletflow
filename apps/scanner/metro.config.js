// Monorepo configuration per Expo's guide. Without this, Metro cannot resolve
// @biletflow/shared from outside apps/scanner.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
// Stops Metro walking up and picking a second copy of react or react-native.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
