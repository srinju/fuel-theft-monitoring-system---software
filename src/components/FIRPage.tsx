import React, { useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';
import { useLocation, useNavigate } from 'react-router-dom';

const FIRPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = location;
  const { locationName, car_status, sensor, eventType, timestamp } = state || {};
  const [firNumber, setFirNumber] = useState('');
  const [firDate, setFirDate] = useState(new Date().toISOString().split('T')[0]);
  const [officerName, setOfficerName] = useState('Inspector Kumar');
  const [description, setDescription] = useState('');

  useEffect(() => {
    // Generate a random FIR number
    const randomFir = 'FIR' + Math.floor(Math.random() * 10000).toString().padStart(5, '0') + '/2023';
    setFirNumber(randomFir);

    // Set default description based on event type
    if (eventType && eventType.includes('Theft')) {
      setDescription(`Fuel theft was detected on the vehicle at ${locationName}. Approximately ${sensor?.fuel_level} liters of fuel was stolen.`);
    } else if (eventType && eventType.includes('Refueling')) {
      setDescription(`Fuel refueling was detected on the vehicle at ${locationName}. Approximately ${sensor?.fuel_level} liters of fuel was added.`);
    } else {
      setDescription(`Incident reported at ${locationName}.`);
    }
  }, [eventType, locationName, sensor?.fuel_level]);

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const currentDate = new Date().toLocaleDateString();
    
    // Add FIR header with logo-like element
    doc.setFillColor(25, 118, 210);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('FIRST INFORMATION REPORT (FIR)', 105, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text('Vehicle Fuel Monitoring System', 105, 25, { align: 'center' });
    
    // Reset styling
    doc.setTextColor(0);
    doc.setFont('helvetica', 'normal');
    
    // Add FIR details
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('FIR Details', 14, 40);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    // Manual table for FIR details
    doc.setLineWidth(0.1);
    doc.line(14, 45, 196, 45);
    doc.setFillColor(41, 128, 185);
    doc.rect(14, 45, 182, 8, 'F');
    doc.setTextColor(255);
    doc.text('Information', 16, 50);
    doc.text('Details', 110, 50);
    doc.setTextColor(0);
    
    // Row 1
    doc.rect(14, 53, 182, 8);
    doc.text('FIR Number', 16, 58);
    doc.text(firNumber, 110, 58);
    
    // Row 2
    doc.rect(14, 61, 182, 8);
    doc.text('Date of Filing', 16, 66);
    doc.text(firDate, 110, 66);
    
    // Row 3
    doc.rect(14, 69, 182, 8);
    doc.text('Reporting Officer', 16, 74);
    doc.text(officerName, 110, 74);
    
    // Row 4
    doc.rect(14, 77, 182, 8);
    doc.text('Location', 16, 82);
    doc.text(locationName || 'Unknown', 110, 82);
    
    // Row 5
    doc.rect(14, 85, 182, 8);
    doc.text('Incident Type', 16, 90);
    doc.text(eventType || 'Unknown', 110, 90);
    
    // Row 6
    doc.rect(14, 93, 182, 8);
    doc.text('Incident Date/Time', 16, 98);
    doc.text(timestamp ? new Date(timestamp).toLocaleString() : currentDate, 110, 98);
    
    // Add vehicle details
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Vehicle Details', 14, 115);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    // Manual table for vehicle details
    doc.line(14, 120, 196, 120);
    doc.setFillColor(41, 128, 185);
    doc.rect(14, 120, 182, 8, 'F');
    doc.setTextColor(255);
    doc.text('Parameter', 16, 125);
    doc.text('Value', 110, 125);
    doc.setTextColor(0);
    
    // Row 1
    doc.rect(14, 128, 182, 8);
    doc.text('Speed at Time of Incident', 16, 133);
    doc.text(`${car_status?.speed || 0} km/h`, 110, 133);
    
    // Row 2
    doc.rect(14, 136, 182, 8);
    doc.text('Ignition Status', 16, 141);
    doc.text(car_status?.ignition ? 'On' : 'Off', 110, 141);
    
    // Row 3
    doc.rect(14, 144, 182, 8);
    doc.text('Vehicle Status', 16, 149);
    doc.text(car_status?.stopped ? 'Stopped' : 'Running', 110, 149);
    
    // Row 4
    doc.rect(14, 152, 182, 8);
    doc.text('Fuel Level', 16, 157);
    doc.text(`${sensor?.fuel_level || 0} %`, 110, 157);
    
    // Row 5
    doc.rect(14, 160, 182, 8);
    doc.text('Temperature', 16, 165);
    doc.text(`${sensor?.temperature || 0} °C`, 110, 165);
    
    // Row 6
    doc.rect(14, 168, 182, 8);
    doc.text('Humidity', 16, 173);
    doc.text(`${sensor?.humidity || 0} %`, 110, 173);
    
    // Add description
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Incident Description', 14, 190);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    // Use splitTextToSize for proper text wrapping
    const splitText = doc.splitTextToSize(description, 180);
    doc.text(splitText, 14, 200);
    
    // Add signature section
    doc.setFontSize(10);
    doc.text('Reporting Officer\'s Signature:', 14, 260);
    doc.line(14, 265, 90, 265);
    doc.text('Date and Time of Report:', 120, 260);
    doc.text(new Date().toLocaleString(), 120, 265);
    
    // Add footer
    doc.setFillColor(25, 118, 210);
    doc.rect(0, 285, 210, 12, 'F');
    doc.setTextColor(255);
    doc.setFontSize(8);
    doc.text('This is an electronically generated document. No physical signature is required.', 105, 291, { align: 'center' });
    doc.text('© Vehicle Fuel Monitoring System - ' + new Date().getFullYear(), 105, 295, { align: 'center' });
    
    // Save the PDF
    doc.save(`${firNumber}.pdf`);
  };

  const handleGoBack = () => {
    navigate('/');
  };

  return (
    <div className="bg-gray-900 min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <div className="bg-gray-800 rounded-xl shadow-xl p-8 max-w-4xl mx-auto border border-gray-700">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 text-transparent bg-clip-text">First Information Report</h1>
            <p className="text-gray-400 mt-2">Vehicle Fuel Monitoring System</p>
          </div>
          
          <div className="bg-gray-900 rounded-lg p-6 mb-8 border border-gray-700">
            <h2 className="text-xl font-bold text-blue-400 mb-4">FIR Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">FIR Number</label>
                <div className="bg-gray-800 border border-gray-600 rounded-md py-2 px-3 text-gray-300">
                  {firNumber}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Date of Filing</label>
                <input
                  type="date"
                  value={firDate}
                  onChange={(e) => setFirDate(e.target.value)}
                  className="bg-gray-800 border border-gray-600 rounded-md py-2 px-3 w-full text-gray-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Reporting Officer</label>
                <input
                  type="text"
                  value={officerName}
                  onChange={(e) => setOfficerName(e.target.value)}
                  className="bg-gray-800 border border-gray-600 rounded-md py-2 px-3 w-full text-gray-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Location</label>
                <div className="bg-gray-800 border border-gray-600 rounded-md py-2 px-3 text-gray-300">
                  {locationName || 'Unknown'}
                </div>
              </div>
            </div>
          </div>
          
          <div className="mb-8">
            <h2 className="text-xl font-bold text-blue-400 mb-4">Incident Details</h2>
            <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Incident Type</label>
                  <div className="bg-gray-800 border border-gray-600 rounded-md py-2 px-3 text-gray-300">
                    {eventType || 'Unknown'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Incident Date/Time</label>
                  <div className="bg-gray-800 border border-gray-600 rounded-md py-2 px-3 text-gray-300">
                    {timestamp ? new Date(timestamp).toLocaleString() : new Date().toLocaleString()}
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="bg-gray-800 border border-gray-600 rounded-md py-2 px-3 w-full text-gray-300"
                />
              </div>
            </div>
          </div>
          
          <div className="bg-gray-900 rounded-lg p-6 mb-8 border border-gray-700">
            <h2 className="text-xl font-bold text-blue-400 mb-4">Vehicle Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Speed</label>
                <div className="bg-gray-800 border border-gray-600 rounded-md py-2 px-3 text-gray-300">
                  {car_status?.speed || 0} km/h
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Ignition</label>
                <div className="bg-gray-800 border border-gray-600 rounded-md py-2 px-3 text-gray-300">
                  {car_status?.ignition ? 'On' : 'Off'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Vehicle Status</label>
                <div className="bg-gray-800 border border-gray-600 rounded-md py-2 px-3 text-gray-300">
                  {car_status?.stopped ? 'Stopped' : 'Running'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Fuel Level</label>
                <div className="bg-gray-800 border border-gray-600 rounded-md py-2 px-3 text-gray-300">
                  {sensor?.fuel_level || 0} %
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Temperature</label>
                <div className="bg-gray-800 border border-gray-600 rounded-md py-2 px-3 text-gray-300">
                  {sensor?.temperature || 0} °C
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Humidity</label>
                <div className="bg-gray-800 border border-gray-600 rounded-md py-2 px-3 text-gray-300">
                  {sensor?.humidity || 0} %
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <button
              onClick={handleGoBack}
              className="bg-gray-700 hover:bg-gray-600 text-gray-200 font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
              Back to Dashboard
            </button>
            
            <button
              onClick={handleDownloadPDF}
              className="bg-gradient-to-r from-blue-600 to-purple-700 hover:from-blue-700 hover:to-purple-800 text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-md hover:shadow-lg flex items-center justify-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Download FIR PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FIRPage;
