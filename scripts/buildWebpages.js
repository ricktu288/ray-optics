const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Copy the third-party libraries used by the non-app webpages (not migrated to Webpack yet) to the /dist/thirdparty folder
fs.mkdirSync(path.join(__dirname, '../dist/thirdparty'), { recursive: true });
fs.copyFileSync(path.join(__dirname, '../node_modules/jquery/dist/jquery.min.js'), path.join(__dirname, '../dist/thirdparty/jquery.min.js'));
fs.mkdirSync(path.join(__dirname, '../dist/thirdparty/bootstrap'), { recursive: true });
fs.copyFileSync(path.join(__dirname, '../node_modules/bootstrap3/dist/css/bootstrap.min.css'), path.join(__dirname, '../dist/thirdparty/bootstrap/bootstrap.min.css'));
fs.copyFileSync(path.join(__dirname, '../node_modules/bootstrap3/dist/js/bootstrap.min.js'), path.join(__dirname, '../dist/thirdparty/bootstrap/bootstrap.min.js'));
fs.mkdirSync(path.join(__dirname, '../dist/thirdparty/fonts'), { recursive: true });
fs.copyFileSync(path.join(__dirname, '../node_modules/bootstrap3/dist/fonts/glyphicons-halflings-regular.woff2'), path.join(__dirname, '../dist/thirdparty/fonts/glyphicons-halflings-regular.woff2'));

// Copy the non-app webpages and data (not migrated to Webpack yet) to the /dist folder
fs.mkdirSync(path.join(__dirname, '../dist'), { recursive: true });
fs.cpSync(path.join(__dirname, '../src/webpages'), path.join(__dirname, '../dist'), { recursive: true });

// Run the old node.js scripts in the non-app webpages folders
const outputGallery = execSync('node ' + path.join(__dirname, '../dist/gallery/generate-gallery.js'), { cwd: path.join(__dirname, '../dist/gallery') });
console.log(outputGallery.toString());
const outputModules = execSync('node ' + path.join(__dirname, '../dist/modules/generate-modules.js'), { cwd: path.join(__dirname, '../dist/modules') });
console.log(outputModules.toString());
