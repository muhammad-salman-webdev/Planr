import React from 'react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoogleImport: () => void;
  onOutlookImport: () => void;
}

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onGoogleImport, onOutlookImport }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg p-6 w-80 relative">
        <button className="absolute top-2 right-2 p-1" onClick={onClose}>
          ×
        </button>
        <h3 className="text-lg font-semibold mb-4">Import from Calendar</h3>
        <button
          className="w-full mb-2 px-3 py-2 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700"
          onClick={onGoogleImport}
        >
          Import from Google Calendar
        </button>
        <button
          className="w-full px-3 py-2 rounded-md bg-blue-900 text-white font-medium hover:bg-blue-950"
          onClick={onOutlookImport}
        >
          Import from Outlook
        </button>
      </div>
    </div>
  );
};

export default ImportModal;
