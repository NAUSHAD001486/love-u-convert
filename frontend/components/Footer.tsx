'use client';

import { useState, useRef, useEffect } from 'react';

export default function Footer() {
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [showComingSoon, setShowComingSoon] = useState(false);
  const languageSelectRef = useRef<HTMLSelectElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(event.target as Node) &&
        languageSelectRef.current &&
        !languageSelectRef.current.contains(event.target as Node)
      ) {
        setShowComingSoon(false);
      }
    };

    if (showComingSoon) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showComingSoon]);

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = e.target.value;
    if (newLanguage !== 'en') {
      setShowComingSoon(true);
      // Reset to English after showing popup
      setTimeout(() => {
        setSelectedLanguage('en');
      }, 0);
      // Auto-hide popup after 2 seconds
      setTimeout(() => {
        setShowComingSoon(false);
      }, 2000);
    } else {
      setSelectedLanguage(newLanguage);
    }
  };

  return (
    <footer className="bg-gray-900 text-gray-300 w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Column 1 - Quick Links */}
          <div>
            <h3 className="text-white font-semibold mb-4 text-base">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <a href="#" className="hover:text-gray-100 transition-colors text-sm">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-gray-100 transition-colors text-sm">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-gray-100 transition-colors text-sm">
                  About Us
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-gray-100 transition-colors text-sm">
                  Contact Us
                </a>
              </li>
            </ul>
          </div>

          {/* Column 2 - Support */}
          <div>
            <h3 className="text-white font-semibold mb-4 text-base">Support</h3>
            <ul className="space-y-2">
              <li>
                <a href="#" className="hover:text-gray-100 transition-colors text-sm">
                  Help Center
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-gray-100 transition-colors text-sm">
                  FAQ
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-gray-100 transition-colors text-sm">
                  Tutorial
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-gray-100 transition-colors text-sm">
                  Feedback
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3 - Language */}
          <div className="relative">
            <h3 className="text-white font-semibold mb-4 text-base">Language</h3>
            <div className="relative w-[60%]">
              {/* Coming Soon Popup */}
              {showComingSoon && (
                <div
                  ref={popupRef}
                  className="absolute bottom-full left-0 mb-2 backdrop-blur-sm border border-purple-400 rounded-lg px-4 py-3 shadow-lg z-50 min-w-[200px]"
                  style={{ backgroundColor: 'rgba(111, 47, 229, 0.5)' }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white text-sm font-semibold">Coming Soon</span>
                    <button
                      onClick={() => setShowComingSoon(false)}
                      className="text-white hover:text-gray-200 transition-colors"
                      aria-label="Close"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
              <select
                ref={languageSelectRef}
                value={selectedLanguage}
                onChange={handleLanguageChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-4 py-2 text-sm text-gray-300 appearance-none cursor-pointer hover:bg-gray-750 focus:outline-none focus:ring-2 focus:ring-gray-600"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="it">Italian</option>
              </select>
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <svg
                  className="w-4 h-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-800 mb-6"></div>

        {/* Bottom Section */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm">
          {/* Copyright */}
          <div className="text-gray-400">
            © 2024 Love U Convert. All rights reserved.
          </div>

          {/* Social Links */}
          <div className="flex gap-6">
            <a
              href="#"
              className="text-gray-400 hover:text-gray-100 transition-colors"
            >
              Facebook
            </a>
            <a
              href="#"
              className="text-gray-400 hover:text-gray-100 transition-colors"
            >
              Twitter
            </a>
            <a
              href="#"
              className="text-gray-400 hover:text-gray-100 transition-colors"
            >
              LinkedIn
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

