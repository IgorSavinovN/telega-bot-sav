// app/layout.js

import { SpeedInsights } from '@vercel/speed-insights';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <SpeedInsights>
          {children}
        </SpeedInsights>
      </body>
    </html>
  );
}