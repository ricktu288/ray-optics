import completenessData from '../../../locales/completeness.json';

let currentTranslations = {};
let isInitialized = false;

function getUserLanguage() {
  return window.lang;
}

async function loadTranslations(language) {
  try {
    const module = await import(`../../../locales/${language}.json`);
    currentTranslations = module.default;
  } catch (error) {
    console.error(`Failed to load translations for ${language}`, error);
    const fallbackModule = await import('../../../locales/en.json');
    currentTranslations = fallbackModule.default;
  }
}

export function getMsg(key) {
  if (!isInitialized) {
    console.warn('Translations not initialized. Call initializeTranslations first.');
  }
  if (!currentTranslations[key]) {
    console.warn(`Translation not found for key: ${key}`);
    return key;
  } else {
    return currentTranslations[key].message;
  }
}

export async function initializeTranslations() {
  if (!isInitialized) {
    const language = getUserLanguage();
    await loadTranslations(language);
    isInitialized = true;
    console.log('Translations initialized');
  } else {
    console.log('Translations already initialized');
  }
}

export function getLanguageCompleteness() {
  return completenessData;
}