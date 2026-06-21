const fs = require('fs');
const path = require('path');

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath);
        } else if (fullPath.endsWith('.js')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            const target1 = "const prisma = require('@/lib/prisma');";
            const target2 = "const prisma = require('@/lib/prisma'); // Shared singleton";
            const replacement = "const prisma = require('@/lib/prisma').prisma || require('@/lib/prisma').default || require('@/lib/prisma');";
            let changed = false;
            
            if (content.includes(target1)) {
                content = content.split(target1).join(replacement);
                changed = true;
            }
            if (content.includes(target2)) {
                content = content.split(target2).join(replacement + " // Shared singleton");
                changed = true;
            }
            
            if (changed) {
                fs.writeFileSync(fullPath, content);
                console.log('Fixed:', fullPath);
            }
        }
    }
}

walkDir('/Users/Babayasa/Documents/Project/LangGraph/whatsapp-ai-chatbot/admin-frontend/lib/ai');
