import simpleGit from 'simple-git';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Convert import.meta.url to a file path and determine the directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Git instance
const git = simpleGit();

// Load contributors from /data/contributors.json
const contributorsPath = path.resolve(__dirname, '../data/contributors.json');
const contributors = JSON.parse(fs.readFileSync(contributorsPath, 'utf8'));

// Initialize commit counts
contributors.forEach(c => c.commits = 0);

// Get Git contributors. If the email is in contributors[...].githubEmails, increment the commit count
const logEntries = await git.raw([
  'log',
  '--pretty=format:%H|%an|%ae|%aI|%s|%P'
]);

const firstEntryHash = logEntries.split('\n')[0].split('|')[0];

if (firstEntryHash !== 'f4c95d6ecb3029ff8346bb2337afc0aadd625d51') {
  console.log('The repo is not completely cloned. Cannot generate contributors list.');
  process.exit(1);
}

logEntries.split('\n').forEach(entry => {
  const [hash, name, email, date, message, parents] = entry.split('|');

  if (!name || !email || !date) {
    console.warn('Skipping invalid log entry:', entry);
    return;
  }

  // Rule out merge commits by checking the number of parents
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
contributors.sort((a, b) => b.commits - a.commits);

// Print contributors
console.log('Contributors:');
contributors.forEach(c => {
  const contribItems = [];
  if (c.contributions.code) {
    contribItems.push('Code');
  }
  if (c.contributions.uiDesign) {
    contribItems.push('UI Design');
  }
  if (c.contributions.gallery) {
    contribItems.push('Gallery');
  }
  if (c.contributions.modules) {
    contribItems.push('Modules');
  }
  if (c.contributions.translations) {
    contribItems.push(c.contributions.translations.join(' & ') + ' Translations');
  }
  console.log(`- ${c.commits} ${c.name} (${contribItems.join(', ')})`);
});