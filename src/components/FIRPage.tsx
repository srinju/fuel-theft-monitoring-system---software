import React from 'react';
import { jsPDF } from 'jspdf';
import { useLocation, useNavigate } from 'react-router-dom';

const FIRPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = location;
  const { locationName, car_status, sensor } = state || {};

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    doc.text('FIR Generated Successfully', 10, 10);
    doc.text('Incident: Fuel Theft Detected', 10, 20);
    doc.text(`Location: ${locationName}`, 10, 30);
    doc.text(`Vehicle Speed: ${car_status?.speed} km/h`, 10, 40);
    doc.text(`Fuel Level: ${sensor?.fuel_level} liters`, 10, 50);
    
    doc.save('FIR.pdf');
  };

  const handleGoBack = () => {
    navigate('/');
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">FIR Generated Successfully</h1>
      <p>Your FIR has been generated. You can download the FIR by clicking the button below.</p>

      <div className="mt-4">
        <button
          onClick={handleDownloadPDF}
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
        >
          Download FIR PDF
        </button>
      </div>

      <div className="mt-4">
        <button
          onClick={handleGoBack}
          className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
};

export default FIRPage;
