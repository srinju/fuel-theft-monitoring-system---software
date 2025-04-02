import React, { useEffect, useState } from 'react';
import { database, ref, onValue, update, push, remove } from '../firebaseConfig';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '../styles.css'; // Adjust the path as needed


interface SensorData {
  fuel_level: number;
  humidity: number;
  temperature: number;
}

interface CarStatus {
  ignition: boolean;
  speed: number;
  stopped: boolean;
  latitude: string;
  longitude: string;
}

interface Alerts {
  fuel_level_difference: number;
  fuel_theft: string;
  is_resolved: boolean;
  is_monitored: boolean;
}

interface FirebaseData {
  alerts: Alerts;
  car_status: CarStatus;
  sensor: SensorData;
}

interface Log {
  id?: string;
  timestamp: string;
  eventType: string;
  location: string;
  carStatus: CarStatus | null;
  sensorData: SensorData | null;
}

// AlertType enum to track alternating alert types
enum AlertType {
  THEFT = 'THEFT',
  REFUELING = 'REFUELING'
}

const Dashboard: React.FC = () => {
  const [data, setData] = useState<FirebaseData | null>(null);
  const [locationName, setLocationName] = useState<string>('Fetching location...');
  const [fuelTheftLogs, setFuelTheftLogs] = useState<Log[]>([]);
  const [refuelingLogs, setRefuelingLogs] = useState<Log[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [currentAlertType, setCurrentAlertType] = useState<AlertType>(AlertType.THEFT);
  //@ts-ignore
  const [selectedLog, setSelectedLog] = useState<Log | null>(null);
  const [originalFuelLevel, setOriginalFuelLevel] = useState<number>(0);
  const navigate = useNavigate();

  // Removed logCooldown and lastLogTime since logs are now only generated on resolving alerts

  useEffect(() => {
    const dataRef = ref(database, '/');
    const logsRef = ref(database, 'logs');

    // Firebase listeners
    const unsubscribeData = onValue(dataRef, (snapshot) => {
      const data = snapshot.val();
      setData(data);
      
      // Store original fuel level for animations
      if (data && !originalFuelLevel) {
        setOriginalFuelLevel(data.sensor.fuel_level);
      }

      // Fetch location whenever car status updates
      if (data && data.car_status.latitude && data.car_status.longitude) {
        fetchLocation(data.car_status.latitude.replace(/°.*$/, ''), data.car_status.longitude.replace(/°.*$/, ''));
      }
    });

    const unsubscribeLogs = onValue(logsRef, (snapshot) => {
      const logs = snapshot.val();
      const theftLogs: Log[] = [];
      const refuelLogs: Log[] = [];

      if (logs) {
        Object.keys(logs).forEach((key) => {
          const log = logs[key];
          if (log.eventType.includes('Theft')) {
            theftLogs.push(log);
          }
          if (log.eventType.includes('Refueling')) {
            refuelLogs.push(log);
          }
        });
      }

      // Sort the logs in descending order by timestamp and take the latest 3
      theftLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      refuelLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setFuelTheftLogs(theftLogs.slice(0, 3));
      setRefuelingLogs(refuelLogs.slice(0, 3));
    });

    // Cleanup listeners on unmount
    return () => {
      unsubscribeData();
      unsubscribeLogs();
    };
  }, [originalFuelLevel]);

  const fetchLocation = async (latitude: string, longitude: string, retries = 3) => {
    const cleanLatitude = parseFloat(latitude.replace(/[^\d.-]/g, ''));
    const cleanLongitude = parseFloat(longitude.replace(/[^\d.-]/g, ''));

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await axios.get(`https://nominatim.openstreetmap.org/reverse?lat=${cleanLatitude}&lon=${cleanLongitude}&format=json`);
        const location = response.data;
        setLocationName(location.display_name);
        return; // Exit the function if successful
      } catch (error) {
        console.error('Error fetching location:', error);
        setLocationName('Error fetching location. Retrying...'); // Notify user that a retry will occur
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retrying
      }
    }

    setLocationName('Unable to fetch location. Please check your connection.'); // Final fallback message
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString(); // Format the timestamp to a readable format
  };

  const handleLogEvent = (eventType: string) => {
    const logsRef = ref(database, 'logs');
    const logData: Log = {
      timestamp: new Date().toISOString(),
      eventType,
      location: locationName,
      carStatus: data?.car_status ?? null,
      sensorData: data?.sensor ?? null,
    };

    push(logsRef, logData)
      .then(() => {
        console.log(`Logged ${eventType} event to Firebase`);
      })
      .catch((error) => {
        console.error(`Error logging ${eventType} event:`, error);
      });
  };

  const handleStartMonitoring = () => {
    if (data) {
      const alertsRef = ref(database, '/alerts');
      update(alertsRef, { is_monitored: true })
        .then(() => {
          console.log("Monitoring started");
          setIsMonitoring(true);
        })
        .catch((error: any) => {
          console.error("Error starting monitoring:", error);
        });
    }
  };

  const handleFIRclick = () => {
    navigate('/fir', { state: { locationName, car_status: data?.car_status, sensor: data?.sensor } });
    handleLogEvent('FIR Reported');
  };

  const handleGenerateFIR = (log: Log) => {
    setSelectedLog(log);
    navigate('/fir', { 
      state: { 
        locationName: log.location, 
        car_status: log.carStatus, 
        sensor: log.sensorData,
        eventType: log.eventType,
        timestamp: log.timestamp
      } 
    });
  };

  const handleResolveIssue = () => {
    if (data) {
      const alertsRef = ref(database, '/alerts');
      const currentFuelTheft = data.alerts.fuel_theft;

      // Determine the eventType based on the current alert
      let eventType = '';
      if (currentFuelTheft.includes("Refueling")) {
        eventType = 'Refueling Detected';
      } else if (currentFuelTheft.includes("Theft")) {
        eventType = 'Fuel Theft Detected';
      }

      if (eventType) {
        // Close the modal
        setShowAlertModal(false);
        
        // Toggle alert type for next time
        setCurrentAlertType(
          currentAlertType === AlertType.THEFT ? AlertType.REFUELING : AlertType.THEFT
        );
        
        update(alertsRef, { is_resolved: true, fuel_theft: 'No alerts', is_monitored: false })
          .then(() => {
            console.log("Issue resolved in Firebase");
            
            // Generate log
            const logsRef = ref(database, 'logs');
            const logData: Log = {
              timestamp: new Date().toISOString(),
              eventType,
              location: locationName,
              carStatus: data.car_status ?? null,
              sensorData: data.sensor ?? null,
            };
            
            push(logsRef, logData)
              .then((reference) => {
                console.log(`Logged ${eventType} event to Firebase`);
                // Get the new log's ID
                const logId = reference.key;
                if (logId) {
                  logData.id = logId;
                  
                  // Add to the appropriate log array
                  if (eventType.includes('Theft')) {
                    setFuelTheftLogs([logData, ...fuelTheftLogs].slice(0, 3));
                  } else if (eventType.includes('Refueling')) {
                    setRefuelingLogs([logData, ...refuelingLogs].slice(0, 3));
                  }
                }
              })
              .catch((error) => {
                console.error(`Error logging ${eventType} event:`, error);
              });
          })
          .catch((error: any) => {
            console.error("Error updating issue status:", error);
          });
      } else {
        console.warn("Unknown fuel_theft type:", currentFuelTheft);
      }
    }
  };

  const handleStartStopVehicle = () => {
    if (data) {
      const carStatusRef = ref(database, '/car_status');
      const newStatus = !data.car_status.stopped;
      
      if (!newStatus) {  // If starting the vehicle
        setShowAlertModal(true);
        
        // Set alert based on current type
        const alertsRef = ref(database, '/alerts');
        const sensorRef = ref(database, '/sensor');
        const fuelDifference = Math.floor(Math.random() * 10) + 5;  // Random amount between 5-15
        
        if (currentAlertType === AlertType.THEFT) {
          // For theft, decrease fuel level
          const newFuelLevel = Math.max(0, data.sensor.fuel_level - fuelDifference);
          update(alertsRef, { 
            fuel_theft: 'Fuel Theft Detected!', 
            fuel_level_difference: fuelDifference,
            is_resolved: false,
            is_monitored: true
          });
          update(sensorRef, { fuel_level: newFuelLevel });
        } else {
          // For refueling, increase fuel level
          const newFuelLevel = Math.min(100, data.sensor.fuel_level + fuelDifference);
          update(alertsRef, { 
            fuel_theft: 'Fuel Refueling Detected!', 
            fuel_level_difference: fuelDifference,
            is_resolved: false,
            is_monitored: true
          });
          update(sensorRef, { fuel_level: newFuelLevel });
        }
      }
      
      update(carStatusRef, { stopped: newStatus, ignition: !newStatus })
        .then(() => {
          console.log(newStatus ? 'Vehicle stopped' : 'Vehicle started');
          if (newStatus) {
            // Log only when the vehicle is stopped
            handleLogEvent('Vehicle Stopped');
          } else {
            handleLogEvent('Vehicle Started');
          }
        })
        .catch((error: any) => {
          console.error('Error updating vehicle status:', error);
        });
    }
  };

  const clearLogs = () => {
    const logsRef = ref(database, 'logs');
    remove(logsRef)
      .then(() => {
        console.log("All logs have been cleared from the database.");
        setFuelTheftLogs([]);
        setRefuelingLogs([]);
      })
      .catch((error: any) => {
        console.error("Error clearing logs:", error);
      });
  };

  if (!data) {
    return <div className="text-center text-xl font-bold text-white bg-gray-900 min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="dashboard-container flex flex-col gap-6 bg-gray-900 text-gray-200 min-h-screen p-6">
      <h1 className='text-center text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 text-transparent bg-clip-text'>Vehicle Monitoring Dashboard</h1>
      
      {/* Alert Modal */}
      {showAlertModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full shadow-2xl transform transition-all border border-gray-700">
            <div className={`text-2xl font-bold mb-4 ${currentAlertType === AlertType.THEFT ? 'text-red-400' : 'text-green-400'}`}>
              {currentAlertType === AlertType.THEFT ? '⚠️ Fuel Theft Detected!' : '🔄 Fuel Refueling Detected!'}
            </div>
            <div className="mb-6">
              <p className="text-gray-300 mb-2">
                {currentAlertType === AlertType.THEFT 
                  ? `Alert: ${data.alerts.fuel_level_difference} liters of fuel has been stolen from your vehicle.` 
                  : `Alert: ${data.alerts.fuel_level_difference} liters of fuel has been added to your vehicle.`
                }
              </p>
              <p className="text-gray-300 mb-2">Location: {locationName}</p>
              <p className="text-gray-300">Time: {new Date().toLocaleString()}</p>
              
              {/* Animated Fuel Meter */}
              <div className="mt-4 p-4 bg-gray-900 rounded-lg">
                <p className="text-sm text-gray-400 mb-2">Fuel Level Change</p>
                <div className="relative pt-1">
                  <div className="flex mb-2 items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold inline-block text-gray-300">
                        Previous: {currentAlertType === AlertType.THEFT ? data.sensor.fuel_level + data.alerts.fuel_level_difference : data.sensor.fuel_level - data.alerts.fuel_level_difference}%
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold inline-block text-gray-300">
                        Current: {data.sensor.fuel_level}%
                      </span>
                    </div>
                  </div>
                  <div className="overflow-hidden h-3 mb-4 text-xs flex rounded bg-gray-700">
                    <div style={{ width: `${data.sensor.fuel_level}%` }} className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${currentAlertType === AlertType.THEFT ? 'bg-red-500' : 'bg-green-500'} transition-all duration-500 ease-in-out`}></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-4">
              <button
                className="bg-gray-700 hover:bg-gray-600 text-gray-200 font-bold py-2 px-4 rounded"
                onClick={() => setShowAlertModal(false)}
              >
                Close
              </button>
              <button
                className={`${currentAlertType === AlertType.THEFT ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white font-bold py-2 px-4 rounded`}
                onClick={handleResolveIssue}
              >
                Resolve Issue
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="status-card p-6 border border-gray-800 bg-gray-800 rounded-lg shadow-lg hover:shadow-xl transition-shadow">
          <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 text-transparent bg-clip-text">Vehicle Status</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${data.car_status.ignition ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span>Ignition: {data.car_status.ignition ? 'On' : 'Off'}</span>
            </div>
            <div>Speed: {data.car_status.speed} km/h</div>
            <div>Status: {data.car_status.stopped ? 'Stopped' : 'Running'}</div>
          </div>
          <button
            className={`w-full mt-4 px-4 py-3 rounded-lg text-white font-bold ${
              data.car_status.stopped ? 'bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800' : 
              'bg-gradient-to-r from-red-600 to-amber-700 hover:from-red-700 hover:to-amber-800'
            } transition-all shadow-md hover:shadow-lg`}
            onClick={handleStartStopVehicle}
          >
            {data.car_status.stopped ? 'Start Vehicle' : 'Stop Vehicle'}
          </button>
        </div>

        <div className="sensor-card p-6 border border-gray-800 rounded-lg bg-gray-800 shadow-lg hover:shadow-xl transition-shadow">
          <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 text-transparent bg-clip-text">Sensor Data</h3>
          <div className="grid grid-cols-1 gap-4">
            <div className="relative pt-1">
              <div className="flex mb-2 items-center justify-between">
                <div>
                  <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-300 bg-blue-900">
                    Fuel Level
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold inline-block text-blue-300">
                    {data.sensor.fuel_level}%
                  </span>
                </div>
              </div>
              <div className="overflow-hidden h-3 mb-4 text-xs flex rounded bg-gray-700">
                <div style={{ width: `${data.sensor.fuel_level}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500 transition-all duration-500 ease-in-out"></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-gray-700 rounded-lg">
                <div className="font-medium text-gray-300">Humidity</div>
                <div className="text-2xl font-bold text-blue-300">{data.sensor.humidity}%</div>
              </div>
              <div className="p-3 bg-gray-700 rounded-lg">
                <div className="font-medium text-gray-300">Temperature</div>
                <div className="text-2xl font-bold text-amber-300">{data.sensor.temperature}°C</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="alert-section p-6 border border-gray-800 rounded-lg bg-gray-800 shadow-lg hover:shadow-xl transition-shadow">
        <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 text-transparent bg-clip-text">Alerts</h3>
        {data.alerts.fuel_theft === 'No alerts' && (
          <div className="p-4 bg-gray-700 rounded-lg">
            <p className="text-green-400">No active alerts. All systems normal.</p>
          </div>
        )}
        {data.alerts.fuel_theft !== 'No alerts' && (
          <div className="p-4 bg-gray-700 rounded-lg">
            <p className="text-red-400 font-bold">Fuel Alert: {data.alerts.fuel_theft}</p>
            <p className="text-red-400">Fuel Level Difference: {data.alerts.fuel_level_difference} L</p>
            <button
              className="bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white px-4 py-2 rounded-lg mt-4 shadow-md hover:shadow-lg transition-all"
              onClick={handleResolveIssue}
            >
              Resolve Issue
            </button>
          </div>
        )}

        {!isMonitoring && (
          <button
            className="bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white px-4 py-2 rounded-lg mt-4 shadow-md hover:shadow-lg transition-all"
            onClick={handleStartMonitoring}
          >
            Start Monitoring
          </button>
        )}
      </div>

      <div className="recent-logs-section p-6 border border-gray-800 rounded-lg bg-gray-800 shadow-lg hover:shadow-xl transition-shadow">
        <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 text-transparent bg-clip-text">Recent Logs</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 bg-gray-900 rounded-lg border border-red-900">
            <h4 className="font-bold mb-4 text-red-400">Fuel Theft Logs</h4>
            {fuelTheftLogs.length > 0 ? (
              <div className="space-y-4">
                {fuelTheftLogs.map((log, index) => (
                  <div key={index} className="p-4 border border-red-900 rounded-lg bg-gray-800 hover:shadow-md transition-shadow">
                    <p className="font-medium text-red-400">{log.eventType}</p>
                    <p className="text-sm text-gray-400 mb-2">Time: {formatTimestamp(log.timestamp)}</p>
                    <p className="text-sm text-gray-400 mb-3">Location: {log.location}</p>
                    <button
                      onClick={() => handleGenerateFIR(log)}
                      className="text-xs bg-red-900 text-red-200 hover:bg-red-800 px-3 py-1 rounded-full"
                    >
                      Generate FIR
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic">No recent theft logs.</p>
            )}
          </div>

          <div className="p-4 bg-gray-900 rounded-lg border border-green-900">
            <h4 className="font-bold mb-4 text-green-400">Refueling Logs</h4>
            {refuelingLogs.length > 0 ? (
              <div className="space-y-4">
                {refuelingLogs.map((log, index) => (
                  <div key={index} className="p-4 border border-green-900 rounded-lg bg-gray-800 hover:shadow-md transition-shadow">
                    <p className="font-medium text-green-400">{log.eventType}</p>
                    <p className="text-sm text-gray-400 mb-2">Time: {formatTimestamp(log.timestamp)}</p>
                    <p className="text-sm text-gray-400 mb-3">Location: {log.location}</p>
                    <button
                      onClick={() => handleGenerateFIR(log)}
                      className="text-xs bg-green-900 text-green-200 hover:bg-green-800 px-3 py-1 rounded-full"
                    >
                      Generate FIR
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic">No recent refueling logs.</p>
            )}
          </div>
        </div>

        <button
          className="bg-gradient-to-r from-gray-600 to-gray-800 hover:from-gray-700 hover:to-gray-900 text-white px-4 py-2 rounded-lg mt-6 shadow-md hover:shadow-lg transition-all"
          onClick={clearLogs}
        >
          Clear Logs
        </button>
      </div>

      <div className="map-section p-6 border border-gray-800 rounded-lg bg-gray-800 shadow-lg hover:shadow-xl transition-shadow">
        <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 text-transparent bg-clip-text">Vehicle Location</h3>
        <div className="rounded-lg overflow-hidden shadow-md">
          {data && (
            <MapContainer
              style={{ height: '300px', width: '100%' }}
              className="z-10"
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker
                position={[parseFloat(data.car_status.latitude.replace(/°.*$/, '')), parseFloat(data.car_status.longitude.replace(/°.*$/, ''))]}
              >
                <Popup>{locationName}</Popup>
              </Marker>
            </MapContainer>
          )}
        </div>
      </div>

      <div className="fir-section p-6 border border-gray-800 rounded-lg bg-gray-800 shadow-lg hover:shadow-xl transition-shadow">
        <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 text-transparent bg-clip-text">FIR Generation</h3>
        <p className="text-gray-400 mb-4">Generate a First Information Report for the latest incident.</p>
        <button
          className="bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white px-6 py-3 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center"
          onClick={handleFIRclick}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
          </svg>
          Generate FIR
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
