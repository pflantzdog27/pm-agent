import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PM Agent - AI-Powered Project Management',
  description: 'ServiceNow consulting project management powered by Claude AI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-gray-50">
          {/* Header */}
          <header className="bg-white border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-xl">PM</span>
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">PM Agent</h1>
                    <p className="text-xs text-gray-500">AI-Powered Project Management</p>
                  </div>
                </div>
                <nav className="flex gap-4">
                  <a href="/" className="text-gray-700 hover:text-primary-600 font-medium">
                    Dashboard
                  </a>
                  <a href="/projects/new" className="text-gray-700 hover:text-primary-600 font-medium">
                    New Project
                  </a>
                </nav>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>

          {/* Footer */}
          <footer className="bg-white border-t border-gray-200 mt-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <p className="text-center text-sm text-gray-500">
                PM Agent - ServiceNow Consulting by Adam Pflantzer
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
