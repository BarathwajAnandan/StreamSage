const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'node_modules', 'dmg-builder', 'vendor', 'dmgbuild', 'core.py');

let content = fs.readFileSync(filePath, 'utf8');

// Replace reload(sys) with importlib.reload(sys)
content = content.replace(
  'reload(sys)  # Reload is a hack',
  'import importlib\nimportlib.reload(sys)  # Reload is a hack'
);

// Remove or comment out the sys.setdefaultencoding line
content = content.replace(
  "sys.setdefaultencoding('UTF8')",
  "# sys.setdefaultencoding('UTF8')  # This is not needed in Python 3"
);

fs.writeFileSync(filePath, content);

console.log('dmg-builder patched successfully');