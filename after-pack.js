const fs = require('fs');
const path = require('path');

exports.default = function(context) {
  console.log('After-pack script started');
  console.log('Build path:', context.appOutDir);

  // Path to your Conda Python interpreter
  const pythonPath = process.env.PYTHON_PATH || '/opt/anaconda3/envs/quiz/bin/python';

  // Try to find the main.js file
  const possiblePaths = [
    path.join(context.appOutDir, 'StreamSage.app', 'Contents', 'Resources', 'app', 'src', 'main.js'),
    path.join(context.appOutDir, 'StreamSage.app', 'Contents', 'Resources', 'app', 'main.js'),
    path.join(context.appOutDir, 'StreamSage.app', 'Contents', 'Resources', 'app.asar', 'src', 'main.js'),
    path.join(context.appOutDir, 'StreamSage.app', 'Contents', 'Resources', 'app.asar', 'main.js'),
    path.join(context.appOutDir, 'Resources', 'app', 'src', 'main.js'),
    path.join(context.appOutDir, 'Resources', 'app', 'main.js'),
    path.join(context.appOutDir, 'Resources', 'app.asar', 'src', 'main.js'),
    path.join(context.appOutDir, 'Resources', 'app.asar', 'main.js')
  ];

  let mainJsPath;
  for (const p of possiblePaths) {
    console.log('Checking path:', p);
    if (fs.existsSync(p)) {
      mainJsPath = p;
      console.log('Found main.js at:', mainJsPath);
      break;
    }
  }

  if (!mainJsPath) {
    console.error('Could not find main.js in any of the expected locations');
    console.log('Listing contents of build directory:');
    listDirectoryContents(context.appOutDir);
    return;
  }

  // Update the Python path in the packaged app
  let mainJs = fs.readFileSync(mainJsPath, 'utf8');
  const originalMainJs = mainJs;
  mainJs = mainJs.replace(
    /const pythonPath = app\.isPackaged\s*\?[^:]+:\s*['"]([^'"]+)['"]/,
    `const pythonPath = app.isPackaged ? path.join(process.resourcesPath, 'python') : '${pythonPath.replace(/\\/g, '\\\\')}'`
  );

  if (mainJs !== originalMainJs) {
    fs.writeFileSync(mainJsPath, mainJs);
    console.log('Updated Python path in main.js');
  } else {
    console.log('No changes needed in main.js');
  }

  console.log('After-pack script completed');
};

function listDirectoryContents(dir) {
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      console.log('Directory:', fullPath);
      listDirectoryContents(fullPath);
    } else {
      console.log('File:', fullPath);
    }
  });
}