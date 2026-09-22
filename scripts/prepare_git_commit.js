const git = require('isomorphic-git');
const fs = require('fs');

async function stageAndCommit() {
  console.log('--- Staging files for Git ---');
  const matrix = await git.statusMatrix({ fs, dir: '.' });
  
  let addedCount = 0;
  for (const [filepath, head, workdir, stage] of matrix) {
    if (workdir >= 1) {
      await git.add({ fs, dir: '.', filepath });
      addedCount++;
    }
  }
  
  console.log(`Staged ${addedCount} files.`);
  
  const sha = await git.commit({
    fs,
    dir: '.',
    author: {
      name: 'Govind Malviya',
      email: 'govindmalviya1990@users.noreply.github.com'
    },
    committer: {
      name: 'Govind Malviya',
      email: 'govindmalviya1990@users.noreply.github.com'
    },
    message: 'Initial release: Full-stack Labour & Project Management SaaS'
  });
  
  console.log('✔ Initial Commit created! Commit SHA:', sha);
}

stageAndCommit().catch(console.error);
