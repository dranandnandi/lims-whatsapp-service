// Simple test to verify Baileys import works
import * as baileys from '@whiskeysockets/baileys';

console.log('🔍 Testing Baileys import...');
console.log('Baileys object:', Object.keys(baileys));
console.log('Default export type:', typeof baileys.default);

// Check if makeWASocket is in the named exports
if (baileys.makeWASocket) {
  console.log('✅ Found makeWASocket in named exports:', typeof baileys.makeWASocket);
} else {
  console.log('❌ makeWASocket not found in named exports');
}

// Check if it's in the default export
if (baileys.default && typeof baileys.default === 'function') {
  console.log('✅ Default export is a function (likely makeWASocket)');
} else if (baileys.default && baileys.default.makeWASocket) {
  console.log('✅ Found makeWASocket in default export:', typeof baileys.default.makeWASocket);
} else {
  console.log('❌ makeWASocket not found in default export');
  console.log('Default export keys:', Object.keys(baileys.default || {}));
}

// Look for any function that might be makeWASocket
const potentialMakeWASocket = baileys.makeWASocket || baileys.default;
console.log('Potential makeWASocket:', typeof potentialMakeWASocket);

if (typeof potentialMakeWASocket === 'function') {
  console.log('✅ Found working makeWASocket function!');
} else {
  console.log('❌ Still no working makeWASocket function found');
}
