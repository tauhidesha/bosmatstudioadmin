import dotenv from 'dotenv';
dotenv.config({ path: '/Users/Babayasa/Documents/Project/LangGraph/whatsapp-ai-chatbot/admin-frontend/.env.local' });
import { getAIResponse } from './lib/server/ai/engine';

async function main() {
  console.log('Testing getAIResponse...');
  try {
    const response = await getAIResponse({
      message: 'iya nmax nya glossy, tapi ada baret dalem dikit2. bisa di repair dikit dikit nggak?',
      senderNumber: '628179481010',
      senderName: 'Tauhid'
    });
    console.log('Result:', response);
  } catch (err) {
    console.error('Crash!', err);
  }
}

main();
