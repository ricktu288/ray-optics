/*
 * Copyright 2024 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Handlebars from 'handlebars';
import { marked } from 'marked';
import i18next from 'i18next';
import simpleGit from 'simple-git';


// Convert import.meta.url to a file path and determine the directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Copy the third-party libraries used by the non-app webpages to the /dist/thirdparty folder
fs.mkdirSync(path.join(__dirname, '../dist/thirdparty'), { recursive: true });
fs.copyFileSync(path.join(__dirname, '../node_modules/jquery/dist/jquery.min.js'), path.join(__dirname, '../dist/thirdparty/jquery.min.js'));
fs.mkdirSync(path.join(__dirname, '../dist/thirdparty/bootstrap'), { recursive: true });
fs.copyFileSync(path.join(__dirname, '../node_modules/bootstrap3/dist/css/bootstrap.min.css'), path.join(__dirname, '../dist/thirdparty/bootstrap/bootstrap.min.css'));
fs.copyFileSync(path.join(__dirname, '../node_modules/bootstrap3/dist/js/bootstrap.min.js'), path.join(__dirname, '../dist/thirdparty/bootstrap/bootstrap.min.js'));
fs.mkdirSync(path.join(__dirname, '../dist/thirdparty/fonts'), { recursive: true });
fs.copyFileSync(path.join(__dirname, '../node_modules/bootstrap3/dist/fonts/glyphicons-halflings-regular.woff2'), path.join(__dirname, '../dist/thirdparty/fonts/glyphicons-halflings-regular.woff2'));
fs.mkdirSync(path.join(__dirname, '../dist/thirdparty/mathjax'), { recursive: true });
fs.copyFileSync(path.join(__dirname, '../node_modules/mathjax/es5/tex-mml-chtml.js'), path.join(__dirname, '../dist/thirdparty/mathjax/tex-mml-chtml.js'));
fs.cpSync(
  path.join(__dirname, '../node_modules/mathjax/es5/output/chtml/fonts'),
  path.join(__dirname, '../dist/thirdparty/mathjax/output/chtml/fonts'),
  { recursive: true }
);




// List all existing languages, which are the directories in the /locales directory. Put English first.
const langs = ['en'].concat(fs.readdirSync(path.join(__dirname, '../locales')).filter((file) => !file.includes('.') && file !== 'en'));

// Load the locale routes data
const routesData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/localeRoutes.json'), 'utf8'));

// Fill the rest of the locale rountes
for (const lang of langs) {
  if (routesData[lang] === undefined) {
    routesData[lang] = '/' + lang;
  }
}


// Load and process contributors data
const git = simpleGit();
const contributors = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/contributors.json'), 'utf8'));

// Initialize commit counts
contributors.forEach(c => c.commits = 0);

// Get Git contributors
const logEntries = await git.raw([
  'log',
  '--reverse',
  '--pretty=format:%H|%an|%ae|%aI|%s|%P'
]);

const firstEntryHash = logEntries.split('\n')[0].split('|')[0];

if (firstEntryHash !== 'c3b4eea281d34fc2aee5186510cceb50cd9db2f5') {
  console.log('The repo is not completely cloned. Cannot generate contributors list.');
  process.exit(1);
}

// Process git log entries
logEntries.split('\n').forEach(entry => {
  const [hash, name, email, date, message, parents] = entry.split('|');

  if (!name || !email || !date) {
    console.warn('Skipping invalid log entry:', entry);
    return;
  }

  // Rule out merge commits
  const parentCount = parents.split(' ').filter(Boolean).length;
  if (parentCount > 1) {
    return;
  }

  const contributor = contributors.find(c => (c.githubEmails || []).includes(email));
  if (contributor) {
    contributor.commits += 1;
  }
});

// Sort contributors by commit count
const sortedContributors = contributors
  .filter(c => !c.isMainAuthor)
  .sort((a, b) => b.commits - a.commits);
const sortedMainAuthors = contributors
  .filter(c => c.isMainAuthor)
  .sort((a, b) => b.commits - a.commits);


// Load the gallery list
const galleryList = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/galleryList.json'), 'utf8'));

// List all existing galleryscenes IDs, which are the file name of the json files in the /data/galleryScenes directory.
const galleryFiles = fs.readdirSync(path.join(__dirname, '../data/galleryScenes'));
const galleryIDs = galleryFiles.filter((file) => file.endsWith('.json')).map((file) => file.replace('.json', ''));

// List all IDs which are in the galleryList
const galleryIDInList = {};
for (const category of galleryList) {
  for (const item of category.content) {
    galleryIDInList[item.id] = true;
  }
}

// Create a dictionary converting the scene IDs to the contributors.
const galleryIDContributors = {};
for (const category of galleryList) {
  for (const item of category.content) {
    galleryIDContributors[item.id] = item.contributors;
  }
}

// Create a dictionary converting the scene IDs to the camelCase format.
const galleryIDToCamelCase = {};
galleryIDs.forEach((id) => {
  galleryIDToCamelCase[id] = id.toLowerCase().replace(/-([a-z])/g, (g) => g[1].toUpperCase());
});

const galleryCategories = galleryList.map(item => item.id);

const galleryCategoryToCamelCase = {};
galleryCategories.forEach((category) => {
  galleryCategoryToCamelCase[category] = category.toLowerCase().replace(/-([a-z])/g, (g) => g[1].toUpperCase());
});

// Load the module list
const moduleList = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/moduleList.json'), 'utf8'));

// Load the English module data
const moduleData = JSON.parse(fs.readFileSync(path.join(__dirname, '../locales/en/modules.json'), 'utf8')).moduleData;

// Create a dictionary mapping the module IDs to the array of control point sequence keys and parameters keys
const moduleControlPointSequenceKeys = {};
const moduleParametersKeys = {};
for (const id in moduleData) {
  // Load the module scene data
  const moduleSceneData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/moduleScenes', id + '.json'), 'utf8'));
  const moduleDef = moduleSceneData.modules[id];
  const numPoints = moduleDef.numPoints;
  moduleControlPointSequenceKeys[id] = [];
  moduleParametersKeys[id] = {};
  for (let i = 1; i <= numPoints; i++) {
    moduleControlPointSequenceKeys[id].push(`modules:moduleData.${id}.point${i}`);
  }
  for (const param of moduleDef.params) {
    const paramName = param.split('=')[0];
    moduleParametersKeys[id][paramName] = `modules:moduleData.${id}.${paramName.replace(/_/g, '')}`;
  }
}

// List all module ids in the moduleList
const moduleIDs = [];
for (const category of moduleList) {
  for (const item of category.content) {
    moduleIDs.push(item.id);
  }
}


// Given a json object, calculate the total number of strings in the object, but string keys of the form key_suffix are treated as the same string as key.
function countStrings(json) {
  const stringKeys = new Set();
  let count = 0;
  for (const key in json) {
    if (typeof json[key] === 'string') {
      if (key.includes('_')) {
        stringKeys.add(key.split('_')[0]);
      } else {
        stringKeys.add(key);
      }
    } else if (typeof json[key] === 'object') {
      count += countStrings(json[key]);
    }
  }
  return count + stringKeys.size;
}

const homeLangs = [];
const aboutLangs = [];
const galleryLangs = [];
const galleryItemsLangs = {};
const modulesLangs = [];
const moduleItemsLangs = {};
const moduleTutorialLangs = [];

for (const id of galleryIDs) {
  galleryItemsLangs[id] = [];
}

for (const id of moduleIDs) {
  moduleItemsLangs[id] = [];
}

const rootAbsUrl = "https://phydemo.app/ray-optics";
const urlMaps = {};
const langNames = {};
const i18nextResources = {};

const enMainData = JSON.parse(fs.readFileSync(path.join(__dirname, '../locales/en/main.json'), 'utf8'));
const enSimulatorData = JSON.parse(fs.readFileSync(path.join(__dirname, '../locales/en/simulator.json'), 'utf8'));
const enGalleryData = JSON.parse(fs.readFileSync(path.join(__dirname, '../locales/en/gallery.json'), 'utf8'));
const enModulesData = JSON.parse(fs.readFileSync(path.join(__dirname, '../locales/en/modules.json'), 'utf8'));

// Load the available languages for each webpage and create the URL maps
for (const lang of langs) {
  // See if the number of strings is large enough, otherwise skip this language.
  const mainPath = path.join(__dirname, '../locales', lang, 'main.json');
  const simulatorPath = path.join(__dirname, '../locales', lang, 'simulator.json');
  const galleryPath = path.join(__dirname, '../locales', lang, 'gallery.json');
  const modulesPath = path.join(__dirname, '../locales', lang, 'modules.json');
  const mainData = fs.existsSync(mainPath) ? JSON.parse(fs.readFileSync(mainPath, 'utf8')) : {};
  const simulatorData = fs.existsSync(simulatorPath) ? JSON.parse(fs.readFileSync(simulatorPath, 'utf8')) : {};
  //console.log(`The main part of ${lang} has ${countStrings(mainData.homePage) + countStrings(mainData.tools) + countStrings(mainData.view)} strings.`);
  if (!(
    mainData.meta && mainData.meta.languageName &&
    mainData.project && mainData.project.name &&
    (countStrings(mainData.homePage) + countStrings(mainData.tools) + countStrings(mainData.view)) > 50
  )) {
    continue;
  }

  const galleryData = fs.existsSync(galleryPath) ? JSON.parse(fs.readFileSync(galleryPath, 'utf8')) : {};
  const modulesData = fs.existsSync(modulesPath) ? JSON.parse(fs.readFileSync(modulesPath, 'utf8')) : {};

  // Add to the i18next resources
  i18nextResources[lang] = {
    main: mainData,
    simulator: simulatorData,
    gallery: galleryData,
    modules: modulesData,
  };
  
  // Add the language name
  langNames[lang] = mainData.meta.languageName || lang;

  urlMaps[lang] = {
    "/simulator": "/simulator/" + (lang === 'en' ? '' : '?' + lang),
    "/phydemo": "https://phydemo.app/",
    "/email": "mailto:ray-optics@phydemo.app",
    "/github": "https://github.com/ricktu288/ray-optics",
    "/github/issues": "https://github.com/ricktu288/ray-optics/issues",
    "/github/discussions": "https://github.com/ricktu288/ray-optics/discussions",
    "/contributing": "https://github.com/ricktu288/ray-optics/blob/master/CONTRIBUTING.md",
    "/contributing/gallery": "https://github.com/ricktu288/ray-optics/blob/master/CONTRIBUTING.md#contributing-items-to-the-gallery",
    "/contributing/modules": "https://github.com/ricktu288/ray-optics/blob/master/CONTRIBUTING.md#contributing-modules",
    "/license": "https://github.com/ricktu288/ray-optics/blob/master/LICENSE",
    "/mathjs/syntax": "https://mathjs.org/docs/reference/functions/evaluate.html",
  };

  homeLangs.push(lang);
  urlMaps[lang]['/home'] = routesData[lang] + '/';

  if (mainData.aboutPage && mainData.pages && mainData.pages.about && mainData.aboutPage.description) {
    aboutLangs.push(lang);
    urlMaps[lang]['/about'] = routesData[lang] + '/about';
  } else {
    urlMaps[lang]['/about'] = '/about';
  }

  if (galleryData.galleryPage && mainData.pages && mainData.pages.gallery && galleryData.galleryPage.title && galleryData.galleryPage.description) {
    galleryLangs.push(lang);
    urlMaps[lang]['/gallery'] = routesData[lang] + '/gallery/';
  } else {
    urlMaps[lang]['/gallery'] = '/gallery/';
  }

  for (const id of galleryIDs) {
    if (galleryData.galleryData && galleryData.galleryData[galleryIDToCamelCase[id]] && galleryData.galleryData[galleryIDToCamelCase[id]].title) {
      galleryItemsLangs[id].push(lang);
      urlMaps[lang][`/gallery/${id}`] = routesData[lang] + '/gallery/' + id;
    } else {
      urlMaps[lang][`/gallery/${id}`] = '/gallery/' + id;
    }
  }

  if (modulesData.modulesPage) {
    modulesLangs.push(lang);
    urlMaps[lang]['/modules/modules'] = routesData[lang] + '/modules/modules.html';
  } else {
    urlMaps[lang]['/modules/modules'] = '/modules/modules.html';
  }

  for (const id of moduleIDs) {
    if (modulesData.moduleData && modulesData.moduleData[galleryIDToCamelCase[id]]) {
      moduleItemsLangs[id].push(lang);
    }
  }

  //console.log(`The module tutorial of ${lang} has ${countStrings(modulesData.moduleTutorial)} strings.`);
  if (countStrings(modulesData.moduleTutorial) > 12) {
    moduleTutorialLangs.push(lang);
    urlMaps[lang]['/modules/tutorial'] = routesData[lang] + '/modules/tutorial';
  } else {
    urlMaps[lang]['/modules/tutorial'] = '/modules/tutorial';
  }
}

// Calculate the fraction of the gallery items that are translated for each language
const galleryItemsTranslated = {};
for (const lang of galleryLangs) {
  galleryItemsTranslated[lang] = galleryIDs.filter(id => galleryItemsLangs[id].includes(lang)).length / galleryIDs.length;
}

// Initialize the i18next resources
i18next.init({
  lng: 'en',
  fallbackLng: 'en',
  load: 'currentOnly',
  ns: ['main', 'simulator', 'gallery', 'modules'],
  resources: i18nextResources,
  interpolation: {
    escapeValue: false
  }
});

// Configure the marked renderer
marked.setOptions({
  breaks: true,
});

// Create the pages
for (const lang of homeLangs) {
  // Change the language of i18next
  i18next.changeLanguage(lang);

  // Format the list of items in the current language
  function formatList(items) {
    if (items.length === 0) return '';
    if (items.length === 1) return items[0];
    return i18next.t('main:meta.list', {
      first: items[0],
      others: formatList(items.slice(1))
    });
  }

  // Create the directory for the language in the /dist directory
  const langDir = path.join(__dirname, '../dist', routesData[lang]);
  fs.mkdirSync(langDir, { recursive: true });

  // Determine the root URL for the language, relative to the current page being built
  let rootUrl = lang == 'en' ? '.' : '..';

  // Register the Handlebars helper
  Handlebars.registerHelper('t', function(key, options) {
    let markdownText = i18next.t(key, options.hash);

    // Map the URLs in the markdown text
    markdownText = markdownText.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, (match, p1, p2) => {
      if (urlMaps[lang][p2]) {
        if (urlMaps[lang][p2].startsWith('/')) {
          return `[${p1}](${rootUrl}${urlMaps[lang][p2]})`;
        } else {
          return `[${p1}](${urlMaps[lang][p2]})`;
        }
      } else {
        return match;
      }
    });
    
    // Wrap the inline LaTeX \(...\) in a code block  
    markdownText = markdownText.replace(/\\\((.*?)\\\)/g, (match, p1) => '`\\(' + p1 + '\\)`');

    // Wrap the LaTeX equations in a code block
    markdownText = markdownText.replace(/\\begin{equation}(.*?)\\end{equation}/g, (match, p1) => '```\\begin{equation}' + p1 + '\\end{equation}```');

    // Convert the markdown text to HTML
    let html = marked(markdownText).trim();

    // Replace the inline LaTeX back to \(...\)
    html = html.replace(/<code>\\\((.*?)\\\)<\/code>/g, (match, p1) => '\\(' + p1 + '\\)');

    // Replace the LaTeX equations back to \\begin{equation}...\end{equation}
    html = html.replace(/<code>\\begin{equation}(.*?)\\end{equation}<\/code>/g, (match, p1) => '\\begin{equation}' + p1 + '\\end{equation}');

    // Remove the outer <p> tag
    if (html.startsWith('<p>') && html.endsWith('</p>')) {
      html = html.substring(3, html.length - 4);
    }

    // If options contains "blank", replace the link with a target="_blank" link
    if (options.hash.blank) {
      html = html.replace(/<a href="/g, '<a target="_blank" href="');
    }

    // If the link is to ray-optics@phydemo.app, prevent it from wrapping.
    html = html.replace(/href="mailto:ray-optics@phydemo.app"/g, 'href="mailto:ray-optics@phydemo.app" style="white-space: nowrap;"');

    return new Handlebars.SafeString(html);
  });

  // Register the partials
  Handlebars.registerPartial('head', fs.readFileSync(path.join(__dirname, '../src/webpages/partials/head.hbs'), 'utf8'));
  Handlebars.registerPartial('navbar', fs.readFileSync(path.join(__dirname, '../src/webpages/partials/navbar.hbs'), 'utf8'));
  Handlebars.registerPartial('footer', fs.readFileSync(path.join(__dirname, '../src/webpages/partials/footer.hbs'), 'utf8'));

  const galleryHashUrl = lang == 'en' ? '' : '..' + routesData[lang] + '/gallery/';

  // Load the home template
  const homeTemplate = Handlebars.compile(fs.readFileSync(path.join(__dirname, '../src/webpages/home.hbs'), 'utf8'));

  const homeData = {
    title: i18next.t('main:project.name') + ' - PhyDemo',
    ogImage: rootAbsUrl + '/img/image.png',
    absUrl: rootAbsUrl + urlMaps[lang]['/home'],
    lang: lang,
    langName: langNames[lang],
    supportedLangs: homeLangs.map((lang) => {
      return {
        lang: lang,
        name: langNames[lang],
        url: rootUrl + urlMaps[lang]['/home'],
        absUrl: rootAbsUrl + urlMaps[lang]['/home'],
      };
    }),
    imgUrl: rootUrl + '/img',
    thirdpartyUrl: rootUrl + '/thirdparty',
    homeUrl: rootUrl + urlMaps[lang]['/home'],
    aboutUrl: rootUrl + urlMaps[lang]['/about'],
    galleryUrl: rootUrl + urlMaps[lang]['/gallery'],
    simulatorUrl: rootUrl + urlMaps[lang]['/simulator'],
    isHome: true,
    isGallery: false,
    isAbout: false,
    compoundMicroscopeHashUrl: (galleryItemsLangs['compound-microscope'].includes(lang) ? galleryHashUrl : '') + 'compound-microscope',
    compoundMicroscopeUrl: rootUrl + urlMaps[lang]['/gallery/compound-microscope'],
    apparentDepthHashUrl: (galleryItemsLangs['apparent-depth'].includes(lang) ? galleryHashUrl : '') + 'apparent-depth',
    apparentDepthUrl: rootUrl + urlMaps[lang]['/gallery/apparent-depth'],
    chromaticDispersionHashUrl: (galleryItemsLangs['chromatic-dispersion'].includes(lang) ? galleryHashUrl : '') + 'chromatic-dispersion',
    chromaticDispersionUrl: rootUrl + urlMaps[lang]['/gallery/chromatic-dispersion'],
  }

  // Create the webpage
  fs.writeFileSync(path.join(langDir, 'index.html'), homeTemplate(homeData));


  // Create the about webpage
  if (aboutLangs.includes(lang)) {

    function formatContributions(contributions) {
      const contribItems = [];
      if (contributions.code) contribItems.push(i18next.t('main:aboutPage.contributionCategories.code'));
      if (contributions.uiDesign) contribItems.push(i18next.t('main:aboutPage.contributionCategories.uiDesign'));
      if (contributions.gallery) contribItems.push(i18next.t('main:aboutPage.contributionCategories.gallery'));
      if (contributions.modules) contribItems.push(i18next.t('main:aboutPage.contributionCategories.module'));
      if (contributions.translations) {
        contribItems.push(i18next.t('main:aboutPage.contributionCategories.translations', {
          count: contributions.translations.length,
          languages: contributions.translations.map(lang => `<span style="font-family: monospace;">${lang}</span>`).join(' & ')
        }));
      }
      return formatList(contribItems);
    }
    const aboutTemplate = Handlebars.compile(fs.readFileSync(path.join(__dirname, '../src/webpages/about.hbs'), 'utf8'));
    const aboutData = {
      title: i18next.t('main:pages.about') + ' - ' + i18next.t('main:project.name'),
      ogImage: rootAbsUrl + '/img/image.png',
      absUrl: rootAbsUrl + urlMaps[lang]['/about'],
      lang: lang,
      langName: langNames[lang],
      supportedLangs: aboutLangs.map((lang) => {
        return {
          lang: lang,
          name: langNames[lang],
          url: rootUrl + urlMaps[lang]['/about'],
          absUrl: rootAbsUrl + urlMaps[lang]['/about'],
        };
      }),
      imgUrl: rootUrl + '/img',
      thirdpartyUrl: rootUrl + '/thirdparty',
      homeUrl: rootUrl + urlMaps[lang]['/home'],
      aboutUrl: rootUrl + urlMaps[lang]['/about'],
      galleryUrl: rootUrl + urlMaps[lang]['/gallery'],
      simulatorUrl: rootUrl + urlMaps[lang]['/simulator'],
      isHome: false,
      isGallery: false,
      isAbout: true,
      version: (() => {
        const packageVersion = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'))).version.replace('-dev', '');
        const lastCommit = logEntries.split('\n').slice(-1)[0].split('|');
        const commitDate = new Date(lastCommit[3]).toISOString().slice(0,10).replace(/-/g,'');
        const commitHash = lastCommit[0].slice(0,7);
        return `${packageVersion}+${commitDate}.${commitHash}`;
      })(),
      mainAuthors: sortedMainAuthors.map(c => {
        const name = (c.name === 'Yi-Ting Tu' && lang.startsWith('zh') ? '凃懿庭 Yi-Ting Tu' : c.name);
        const url = (c.name === 'Yi-Ting Tu') ? 'https://yitingtu.com' : '';
        return new Handlebars.SafeString(i18next.t('main:meta.parentheses', {
          main: url ? `<a href="${url}">${name}</a>` : name,
          sub: formatContributions(c.contributions)
        }));
      }),
      contributors: sortedContributors.map(c => {
        return new Handlebars.SafeString(i18next.t('main:meta.parentheses', {
          main: c.name,
          sub: formatContributions(c.contributions)
        }))
      }),
    }
    fs.writeFileSync(path.join(langDir, 'about.html'), aboutTemplate(aboutData));
  }

  // Create the gallery webpage
  if (galleryLangs.includes(lang)) {
    // Create the gallery/ directory
    const galleryDir = path.join(langDir, 'gallery');
    fs.mkdirSync(galleryDir, { recursive: true });
    rootUrl = lang == 'en' ? '..' : '../..';

    const galleryTemplate = Handlebars.compile(fs.readFileSync(path.join(__dirname, '../src/webpages/gallery.hbs'), 'utf8'));
    const galleryData = {
      title: i18next.t('main:pages.gallery') + ' - ' + i18next.t('main:project.name'),
      ogImage: rootAbsUrl + '/img/image.png',
      absUrl: rootAbsUrl + urlMaps[lang]['/gallery'],
      lang: lang,
      langName: langNames[lang],
      supportedLangs: galleryLangs.map((lang) => {
        return {
          lang: lang,
          name: langNames[lang],
          url: rootUrl + urlMaps[lang]['/gallery'],
          absUrl: rootAbsUrl + urlMaps[lang]['/gallery'],
          translatedFraction: i18next.t('main:meta.parentheses', {
            main: '',
            sub: i18next.t('main:languageDropdown.translatedFraction', {
              fraction: Math.round(galleryItemsTranslated[lang] * 100) + '%'
            })
          }),
        };
      }),
      imgUrl: rootUrl + '/img',
      thirdpartyUrl: rootUrl + '/thirdparty',
      homeUrl: rootUrl + urlMaps[lang]['/home'],
      aboutUrl: rootUrl + urlMaps[lang]['/about'],
      galleryUrl: rootUrl + urlMaps[lang]['/gallery'],
      simulatorUrl: rootUrl + urlMaps[lang]['/simulator'],
      isHome: false,
      isGallery: true,
      isAbout: false,
      categories: galleryList.map(item => {
        return {
          id: item.id,
          title: i18next.t('gallery:galleryPage.categories.' + galleryCategoryToCamelCase[item.id]),
          items: item.content.map(contentItem => {
            return {
              id: contentItem.id,
              title: i18next.t('gallery:galleryData.' + galleryIDToCamelCase[contentItem.id] + '.title'),
              url: rootUrl + urlMaps[lang]['/gallery/' + contentItem.id],
              contributors: contentItem.contributors.join(', '),
            };
          }),
        };
      }),
    }
    fs.writeFileSync(path.join(galleryDir, 'index.html'), galleryTemplate(galleryData));

    // Load the gallery item template
    const galleryItemTemplate = Handlebars.compile(fs.readFileSync(path.join(__dirname, '../src/webpages/galleryItem.hbs'), 'utf8'));

    // Create the gallery item webpages
    for (const id of galleryIDs) {
      if (!galleryItemsLangs[id].includes(lang)) continue;
      if (!galleryIDInList[id]) continue;

      const galleryItemData = {
        title: i18next.t('gallery:galleryData.' + galleryIDToCamelCase[id] + '.title') + ' - ' + i18next.t('main:project.name'),
        ogImage: rootAbsUrl + urlMaps[lang]['/gallery/' + id] + '.jpg',
        absUrl: rootAbsUrl + urlMaps[lang]['/gallery/' + id],
        lang: lang,
        langName: langNames[lang],
        supportedLangs: galleryItemsLangs[id].map((lang) => {
          return {
            lang: lang,
            name: langNames[lang],
            url: rootUrl + urlMaps[lang]['/gallery/' + id],
            absUrl: rootAbsUrl + urlMaps[lang]['/gallery/' + id],
          };
        }),
        imgUrl: rootUrl + '/img',
        thirdpartyUrl: rootUrl + '/thirdparty',
        homeUrl: rootUrl + urlMaps[lang]['/home'],
        aboutUrl: rootUrl + urlMaps[lang]['/about'],
        galleryUrl: rootUrl + urlMaps[lang]['/gallery'],
        simulatorUrl: rootUrl + urlMaps[lang]['/simulator'],
        isHome: false,
        isGallery: true,
        isAbout: false,
        id: id,
        titleKey: 'gallery:galleryData.' + galleryIDToCamelCase[id] + '.title',
        descriptionKey: 'gallery:galleryData.' + galleryIDToCamelCase[id] + '.description',
        idHashUrl: (lang == 'en' ? '' : '..' + routesData[lang] + '/gallery/') + id,
        contributors: galleryIDContributors[id].join(', '),
        contributorCount: galleryIDContributors[id].length,
      }
      fs.writeFileSync(path.join(galleryDir, id + '.html'), galleryItemTemplate(galleryItemData));
    }
  }

  // Create the modules webpage
  if (modulesLangs.includes(lang)) {
    // create the modules/ directory
    const modulesDir = path.join(langDir, 'modules');
    fs.mkdirSync(modulesDir, { recursive: true });
    rootUrl = lang == 'en' ? '..' : '../..';

    // Load the modules template
    const modulesTemplate = Handlebars.compile(fs.readFileSync(path.join(__dirname, '../src/webpages/modules.hbs'), 'utf8'));
    const modulePageData = {
      lang: lang,
      langName: langNames[lang],
      imgUrl: rootUrl + '/img',
      thirdpartyUrl: rootUrl + '/thirdparty',
      content: moduleList[0].content.map(item => {
        return {
          id: item.id,
          thumbnailUrl: rootUrl + '/modules/' + item.id + '-thumbnail',
          titleKey: 'modules:moduleData.' + item.id + '.title',
          contributors: item.contributors.join(', '),
          descriptionKey: 'modules:moduleData.' + item.id + '.description',
          hasControlPoints: moduleControlPointSequenceKeys[item.id].length > 0,
          hasParameters: Object.keys(moduleParametersKeys[item.id]).length > 0,
          controlPointSequenceKeys: moduleControlPointSequenceKeys[item.id],
          parametersKeys: moduleParametersKeys[item.id],
        };
      }),
    }
    fs.writeFileSync(path.join(modulesDir, 'modules.html'), modulesTemplate(modulePageData));

    // Create the module tutorial webpage
    if (moduleTutorialLangs.includes(lang)) {
      const moduleTutorialTemplate = Handlebars.compile(fs.readFileSync(path.join(__dirname, '../src/webpages/moduleTutorial.hbs'), 'utf8'));

      const galleryHashUrl = lang == 'en' ? '' : '..' + routesData[lang] + '/gallery/';
      const moduleTutorialData = {
        title: i18next.t('modules:moduleTutorial.title') + ' - ' + i18next.t('main:project.name'),
        ogImage: rootAbsUrl + '/img/image.png',
        absUrl: rootAbsUrl + urlMaps[lang]['/modules/tutorial'],
        lang: lang,
        langName: langNames[lang],
        supportedLangs: moduleTutorialLangs.map((lang) => {
          return {
            lang: lang,
            name: langNames[lang],
            url: rootUrl + urlMaps[lang]['/modules/tutorial'],
            absUrl: rootAbsUrl + urlMaps[lang]['/modules/tutorial'],
          };
        }),
        imgUrl: rootUrl + '/img',
        thirdpartyUrl: rootUrl + '/thirdparty',
        homeUrl: rootUrl + urlMaps[lang]['/home'],
        aboutUrl: rootUrl + urlMaps[lang]['/about'],
        galleryUrl: rootUrl + urlMaps[lang]['/gallery'],
        simulatorUrl: rootUrl + urlMaps[lang]['/simulator'],
        isHome: false,
        isGallery: false,
        isAbout: false,
        moduleExampleBasicsHashUrl: (galleryItemsLangs['module-example-basics'].includes(lang) ? galleryHashUrl : '') + 'module-example-basics',
        moduleExampleParametersHashUrl: (galleryItemsLangs['module-example-parameters'].includes(lang) ? galleryHashUrl : '') + 'module-example-parameters',
        moduleExampleControlPointsHashUrl: (galleryItemsLangs['module-example-control-points'].includes(lang) ? galleryHashUrl : '') + 'module-example-control-points',
        moduleExampleArraysAndConditionalsHashUrl: (galleryItemsLangs['module-example-arrays-and-conditionals'].includes(lang) ? galleryHashUrl : '') + 'module-example-arrays-and-conditionals',
        moduleExampleCustomEquationHashUrl: (galleryItemsLangs['module-example-custom-equation'].includes(lang) ? galleryHashUrl : '') + 'module-example-custom-equation',
        moduleExampleShapeParametrizationHashUrl: (galleryItemsLangs['module-example-shape-parametrization'].includes(lang) ? galleryHashUrl : '') + 'module-example-shape-parametrization',
      }
      fs.writeFileSync(path.join(modulesDir, 'tutorial.html'), moduleTutorialTemplate(moduleTutorialData));
    }
  }
}
