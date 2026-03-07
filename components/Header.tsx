
import React, { useState } from 'react';

interface HeaderProps {
  reminderCount: number;
  notifications: string[];
  clearNotifications: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const Header: React.FC<HeaderProps> = ({ reminderCount, notifications, clearNotifications, searchQuery, onSearchChange }) => {
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="flex-1 flex items-center max-w-xl">
        <div className="relative w-full">
          <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400">
            <SearchIcon />
          </span>
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="חיפוש לידים, מספרי טלפון או שמות..."
            className="w-full bg-gray-50 border border-gray-200 rounded-full py-2 pr-10 pl-4 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <BellIcon />
            {reminderCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full border border-white font-bold">
                {reminderCount}
              </span>
            )}
          </button>
          
          {showNotifications && (
            <div className="absolute left-0 mt-2 w-80 bg-white border border-gray-100 rounded-2xl shadow-2xl z-50 p-4 animate-in slide-in-from-top-2 duration-200">
              <div className="flex justify-between items-center mb-4 border-b border-gray-50 pb-2">
                <h3 className="text-sm font-bold text-gray-800">התראות ותזכורות</h3>
                <button onClick={clearNotifications} className="text-[10px] text-blue-600 hover:underline">נקה הכל</button>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {notifications.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4 italic">אין התראות חדשות</p>
                ) : (
                  notifications.map((n, i) => (
                    <div key={i} className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-800 font-medium">
                      {n}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-800">מנהל מערכת</p>
            <p className="text-xs text-gray-500">מנהל בכיר</p>
          </div>
          <img src="https://picsum.photos/40/40" alt="Avatar" className="w-10 h-10 rounded-full border border-gray-200" />
        </div>
      </div>
    </header>
  );
};

const SearchIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
const BellIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>;

export default Header;
