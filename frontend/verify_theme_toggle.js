const fs = require('fs');
const globals = fs.readFileSync('frontend/app/globals.css', 'utf8');

// Check Light Mode :root variables
const lightBackground = globals.match(/:root\s*{[^}]*--background:\s*#ffffff;/);
const lightForeground = globals.match(/:root\s*{[^}]*--foreground:\s*#1f2937;/);
const lightCard = globals.match(/:root\s*{[^}]*--card:\s*#ffffff;/);

// Check Dark Mode .dark variables
const darkBackground = globals.match(/\.dark\s*{[^}]*--background:\s*#020617;/);
const darkCard = globals.match(/\.dark\s*{[^}]*--card:\s*#1e293b;/);
const darkForeground = globals.match(/\.dark\s*{[^}]*--foreground:\s*#f8fafc;/);

if (lightBackground && lightForeground && lightCard && darkBackground && darkCard && darkForeground) {
  console.log('CSS Variables verification PASSED');
} else {
  console.log('CSS Variables verification FAILED');
  if (!lightBackground) console.log('Light Background mismatch');
  if (!lightForeground) console.log('Light Foreground mismatch');
  if (!lightCard) console.log('Light Card mismatch');
  if (!darkBackground) console.log('Dark Background mismatch');
  if (!darkCard) console.log('Dark Card mismatch');
  if (!darkForeground) console.log('Dark Foreground mismatch');
  process.exit(1);
}
