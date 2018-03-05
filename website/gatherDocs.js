#!/usr/bin/env node
const fs = require("fs-extra");
const git = require("nodegit");
const execSync = require('child_process').execSync;
const REPO_URL = "https://github.com/wix/detox.git"

// From https://gist.github.com/joerx/3296d972735adc5b4ec1
function clearRequireCache() {
  Object.keys(require.cache).forEach(function (key) {
    delete require.cache[key];
  });
}

function getMajorVersion(tag) {
  return parseInt(tag.split('.')[0], 10)
}

async function getVersions() {
  const tmp = fs.mkdtempSync('detox');
  const repo = await git.Clone(REPO_URL, tmp);
  const tags = await git.Tag.list(repo);

  const semverTags = tags
    .filter(tag => tag.split('.').length === 3 && getMajorVersion(tag) >= 6)
    .sort()
    .reverse();
  await fs.remove(tmp);
  return semverTags;
}

const sidebars = [];

(async function () {
  const versions = await getVersions();
  console.log("Cleanup versioned docs");
  await fs.remove("./versions.json")
  await fs.emptyDir("./versioned_docs");
  await fs.emptyDir("./versioned_sidebars");

  fs.writeFileSync("./versions.json", JSON.stringify(versions), "utf8");
  for (let version of versions) {
    const tempDir = fs.mkdtempSync('detox');
    console.log("Clone repository into tmp directory");
    const repo = await git.Clone(REPO_URL, tempDir);

    console.log("Checking out version", version);
    await repo.checkoutBranch(version);

    console.log("Generating versioned doc for", version)
    execSync(`npm install && npm run version ${version}`, { cwd: tempDir + '/website' })

    console.log("Copy versioned doc");
    fs.copySync(`${tempDir}/website/versioned_docs/version-${version}`, `./versioned_docs/version-${version}`);

    console.log("Copy sidebar into versioned_sidebars");
    clearRequireCache();
    sidebars[version] = require(`./${tempDir}/website/sidebars`);

    sidebars[version][`version-${version}-docs`] = sidebars[version].docs;
    delete sidebars[version].docs;

    fs.writeFileSync(`./versioned_sidebars/version-${version}-sidebars.json`, JSON.stringify(sidebars[version]), "utf8");

    console.log("Cleanup temporary clone");
    await fs.remove(tempDir);
  }
})();

