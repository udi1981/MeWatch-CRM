
import React from 'react';

const PnLView: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
        <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">P&L — רווח והפסד</h2>
        <p className="text-gray-500 max-w-md mx-auto">
          כאן יופיע דוח רווח והפסד מלא — הוצאות מ-iCount, הכנסות ממנויים, מכירות באתר ואפיקי הכנסה נוספים.
          ניתן יהיה להוסיף אפיקי הכנסות, הוצאות ולראות סיכום חודשי.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-600 rounded-xl text-sm font-medium">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          בקרוב — שלב 4
        </div>
      </div>
    </div>
  );
};

export default PnLView;
