import fs from 'fs';
import path from 'path';

const updateImports = (dir) => {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      updateImports(fullPath);
    } else if (file.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      // Update relative imports by appending `.js` extension
      content = content.replace(/(from\s+['"])(\..*?)(['"])/g, '$1$2.js$3');
      fs.writeFileSync(fullPath, content, 'utf8');
    }
  }
};

const distDir = './dist';
updateImports(distDir);
