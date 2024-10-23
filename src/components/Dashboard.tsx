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
  timestamp: string;
  eventType: string;
  location: string;
  carStatus: CarStatus | null;
  sensorData: SensorData | null;
}

const Dashboard: React.FC = () => {
  const [data, setData] = useState<FirebaseData | null>(null);
  const [locationName, setLocationName] = useState<string>('Fetching location...');
  const [fuelTheftLogs, setFuelTheftLogs] = useState<Log[]>([]);
  const [refuelingLogs, setRefuelingLogs] = useState<Log[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const navigate = useNavigate();

  // Removed logCooldown and lastLogTime since logs are now only generated on resolving alerts

  useEffect(() => {
    const dataRef = ref(database, '/');
    const logsRef = ref(database, 'logs');

    // Firebase listeners
    const unsubscribeData = onValue(dataRef, (snapshot) => {
      const data = snapshot.val();
      setData(data);

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
  }, []);

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

  const handleResolveIssue = () => {
    if (data) {
      const alertsRef = ref(database, '/alerts');
      const currentFuelTheft = data.alerts.fuel_theft;

      // Determine the eventType based on the current alert
      let eventType = '';
      if (currentFuelTheft.includes("Refueling")) {
        eventType = 'Refueling';
      } else if (currentFuelTheft.includes("Theft")) {
        eventType = 'Theft';
      }

      if (eventType) {
        update(alertsRef, { is_resolved: true, fuel_theft: 'No alerts', is_monitored: false })
          .then(() => {
            console.log("Issue resolved in Firebase");
            handleLogEvent(eventType);
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
    return <div className="text-center text-xl font-bold">Loading...</div>;
  }

  return (
    <div className="dashboard-container flex flex-col gap-6">
      <h1 className='text-center text-5xl'>Dashboard</h1>
      <div className="grid grid-cols-2 gap-4">
        <div className="status-card p-4 border bg-slate-200 rounded-lg shadow-md">
          <h3 className="text-lg font-bold mb-4">Vehicle Status</h3>
          <p>Ignition: {data.car_status.ignition ? 'On' : 'Off'}</p>
          <p>Speed: {data.car_status.speed} km/h</p>
          <p>Status: {data.car_status.stopped ? 'Stopped' : 'Running'}</p>
          <button
            className="bg-green-500 text-white px-4 py-2 rounded-lg mt-4"
            onClick={handleStartStopVehicle}
          >
            {data.car_status.stopped ? 'Start Vehicle' : 'Stop Vehicle'}
          </button>
        </div>

        <div className="sensor-card p-4 border rounded-lg bg-slate-200 shadow-md">
          <h3 className="text-lg font-bold mb-4">Sensor Data</h3>
          <p>Fuel Level: {data.sensor.fuel_level} %</p>
          <p>Humidity: {data.sensor.humidity} %</p>
          <p>Temperature: {data.sensor.temperature} °C</p>
        </div>
      </div>

      <div className="alert-section p-4 border rounded-lg bg-slate-200 shadow-md">
        <h3 className="text-lg font-bold mb-4">Alerts</h3>
        {data.alerts.fuel_theft === 'No alerts' && <p>No alerts.</p>}
        {data.alerts.fuel_theft !== 'No alerts' && (
          <>
            <p>Fuel Alert: {data.alerts.fuel_theft}</p>
            <p>Fuel Level Difference: {data.alerts.fuel_level_difference} L</p>
            <button
              className="bg-green-500 text-white px-4 py-2 rounded-lg mt-4 mr-4"
              onClick={handleResolveIssue}
            >
              Resolve Issue
            </button>
          </>
        )}

        {!isMonitoring && (
          <button
            className="bg-green-500 text-white px-4 py-2 rounded-lg mt-4"
            onClick={handleStartMonitoring}
          >
            Start Monitoring
          </button>
        )}
      </div>

      <div className="recent-logs-section p-4 border rounded-lg bg-slate-200 shadow-md">
        <h3 className="text-lg font-bold mb-4">Recent Logs</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="font-bold mb-2">Fuel Theft Logs</h4>
            {fuelTheftLogs.length > 0 ? (
              <ul>
                {fuelTheftLogs.map((log, index) => (
                  <li key={index} className="mb-2">
                    <p>Event: {log.eventType}</p>
                    <p>Time: {formatTimestamp(log.timestamp)}</p>
                    <p>Location: {log.location}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No recent theft logs.</p>
            )}
          </div>

          <div>
            <h4 className="font-bold mb-2">Refueling Logs</h4>
            {refuelingLogs.length > 0 ? (
              <ul>
                {refuelingLogs.map((log, index) => (
                  <li key={index} className="mb-2">
                    <p>Event: {log.eventType}</p>
                    <p>Time: {formatTimestamp(log.timestamp)}</p>
                    <p>Location: {log.location}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No recent refueling logs.</p>
            )}
          </div>
        </div>

        <button
          className="bg-green-500 text-white px-4 py-2 rounded-lg mt-4"
          onClick={clearLogs}
        >
          Clear Logs
        </button>
      </div>

      <div className="map-section p-4 border rounded-lg shadow-md">
        <h3 className="text-lg font-bold mb-4">Vehicle Location</h3>
        <MapContainer
          center={[parseFloat(data.car_status.latitude.replace(/°.*$/, '')), parseFloat(data.car_status.longitude.replace(/°.*$/, ''))]}
          zoom={13}
          style={{ height: '300px', width: '100%' }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker
            position={[parseFloat(data.car_status.latitude.replace(/°.*$/, '')), parseFloat(data.car_status.longitude.replace(/°.*$/, ''))]}
          >
            <Popup>{locationName}</Popup>
          </Marker>
        </MapContainer>
      </div>

      <div className="fir-section p-4 border rounded-lg shadow-md">
        <button
          className="bg-green-500 text-white px-4 py-2 rounded-lg"
          onClick={handleFIRclick}
        >
          Generate FIR
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
