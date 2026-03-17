const fs = require('fs');
const path = require('path');

// רשימת התיקיות שנגבה (כל המערכת)
const folders = ['app', 'components', 'lib', 'hooks', 'types', 'schema']; 
// שם קובץ הגיבוי שיווצר
const outputFile = 'full_system_backup.txt';

let content = '--- FULL SYSTEM BACKUP ---\n';
content += `Date: ${new Date().toISOString()}\n\n`;

function readFolder(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            readFolder(filePath);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.css') || file.endsWith('.js') || file.endsWith('.json')) {
            // לא כולל קבצי מערכת פנימיים
            if (!filePath.includes('.next') && !filePath.includes('node_modules')) {
                content += `\n\n========================================\n`;
                content += `FILE: ${filePath}\n`;
                content += `========================================\n`;
                content += fs.readFileSync(filePath, 'utf8');
            }
        }
    });
}

// 1. מעבר על כל התיקיות
folders.forEach(folder => readFolder(folder));

// 2. הוספת קבצי הגדרות חשובים מהתיקייה הראשית
['package.json', 'tsconfig.json', 'next.config.mjs', 'tailwind.config.js', 'postcss.config.js', '.env.local'].forEach(file => {
    if (fs.existsSync(file)) {
        content += `\n\n========================================\n`;
        content += `FILE: ${file}\n`;
        content += `========================================\n`;
        content += fs.readFileSync(file, 'utf8');
    }
});

// 3. שמירת הקובץ
fs.writeFileSync(outputFile, content);
console.log(`✅ גיבוי בוצע בהצלחה! הקובץ נוצר: ${outputFile}`);
