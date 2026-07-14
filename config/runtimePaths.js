const path = require('path');

const isPkg = typeof process.pkg !== 'undefined';
const projectRoot = path.resolve(__dirname, '..');
const runtimeRoot = isPkg ? path.dirname(process.execPath) : projectRoot;

function resolveProjectPath(...segments) {
  return path.resolve(projectRoot, ...segments);
}

function resolveRuntimePath(...segments) {
  return path.resolve(runtimeRoot, ...segments);
}

module.exports = {
  isPkg,
  projectRoot,
  runtimeRoot,
  resolveProjectPath,
  resolveRuntimePath,
};
