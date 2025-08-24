const fs = require('fs');
const path = require('path');

// Clear Next.js cache directories
const cacheDirs = [
  '.next',
  'node_modules/.cache',
  '.swc'
];

console.log('🧹 Clearing cache directories...');

cacheDirs.forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  if (fs.existsSync(fullPath)) {
    try {
      fs.rmSync(fullPath, { recursive: true, force: true });
      console.log(`✅ Cleared: ${dir}`);
    } catch (error) {
      console.log(`❌ Failed to clear ${dir}:`, error.message);
    }
  } else {
    console.log(`⚠️  Directory not found: ${dir}`);
  }
});

console.log('🎉 Cache clearing completed!');
console.log('💡 Please restart your development server with: npm run dev');
