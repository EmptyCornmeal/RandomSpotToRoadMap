const map = L.map('map').setView([20, 0], 2); // Default world view

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

let countries; // Store GeoJSON features
let randomPoint; // Store the random point
let bufferCircle; // To store the buffer circle
let roadLayer; // To display the nearest road
let connectionLine; // To draw a line between the point and the road

// Load GeoJSON
fetch('world-administrative-boundaries.geojson') // Update with the correct path if needed
  .then((response) => response.json())
  .then((data) => {
    countries = data.features; // Save countries globally
    L.geoJSON(data).addTo(map); // Add all countries to the map
  });

// Calculate bounding box for a feature
function calculateBBox(feature) {
  const coordinates = feature.geometry.coordinates.flat(Infinity); // Handle deeply nested arrays
  const lngs = coordinates.filter((_, i) => i % 2 === 0); // Extract longitudes
  const lats = coordinates.filter((_, i) => i % 2 !== 0); // Extract latitudes
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}

// Pick a random country
function getRandomCountry() {
  const randomIndex = Math.floor(Math.random() * countries.length);
  return countries[randomIndex];
}

// Generate a random point within a country's bounding box
function getRandomPointInCountry(country) {
  const bbox = calculateBBox(country); // Get the bounding box
  const [minLng, minLat, maxLng, maxLat] = bbox;

  while (true) {
    const randomLng = Math.random() * (maxLng - minLng) + minLng;
    const randomLat = Math.random() * (maxLat - minLat) + minLat;

    try {
      const point = turf.point([randomLng, randomLat]);

      // Handle both Polygon and MultiPolygon geometries
      const isValidPoint =
        country.geometry.type === 'Polygon'
          ? turf.booleanPointInPolygon(point, country)
          : country.geometry.type === 'MultiPolygon'
          ? country.geometry.coordinates.some((polygon) =>
              turf.booleanPointInPolygon(point, { type: 'Polygon', coordinates: polygon })
            )
          : false;

      if (isValidPoint) {
        return [randomLat, randomLng]; // Leaflet uses [lat, lng]
      }
    } catch (error) {
      console.error('Error validating point:', error);
      console.error('Country geometry:', country.geometry);
      throw error; // Re-throw the error for further debugging
    }
  }
}

// Find the closest road and draw a line to it
async function findClosestRoad() {
  if (!randomPoint) {
    alert('Generate a random point first!');
    return;
  }

  const [lat, lng] = randomPoint;
  let bufferSize = 1; // Start with a 1 km buffer
  const maxBufferSize = 100; // Safety limit to prevent indefinite loops

  while (bufferSize <= maxBufferSize) {
    // Draw a buffer circle around the random point
    if (bufferCircle) {
      map.removeLayer(bufferCircle);
    }
    bufferCircle = L.circle(randomPoint, {
      radius: bufferSize * 1000, // Convert km to meters
      color: 'red',
      fillOpacity: 0.2,
    }).addTo(map);

    // Zoom to the buffer
    map.fitBounds(bufferCircle.getBounds());

    // Query Overpass API for roads within the current buffer
    const overpassUrl = `https://overpass-api.de/api/interpreter?data=[out:json];way["highway"](around:${bufferSize * 1000},${lat},${lng});out geom;`;

    try {
      const response = await fetch(overpassUrl);
      const data = await response.json();

      if (data.elements.length > 0) {
        // A road is found
        const road = data.elements[0]; // Nearest road
        const roadCoordinates = road.geometry.map((point) => [point.lat, point.lon]);

        console.log(`Found road: ${road.tags.name || 'Unnamed road'}`);

        // Clear the previous road layer
        if (roadLayer) {
          map.removeLayer(roadLayer);
        }

        // Add the road to the map
        roadLayer = L.polyline(roadCoordinates, { color: 'blue', weight: 4 }).addTo(map);

        // Find the closest point on the road to the random point
        const nearestPoint = road.geometry.reduce((closest, point) => {
          const distance = turf.distance(turf.point([lng, lat]), turf.point([point.lon, point.lat]));
          return distance < closest.distance ? { point, distance } : closest;
        }, { distance: Infinity }).point;

        // Draw a line between the random point and the nearest point on the road
        if (connectionLine) {
          map.removeLayer(connectionLine);
        }
        connectionLine = L.polyline([[lat, lng], [nearestPoint.lat, nearestPoint.lon]], {
          color: 'green',
          weight: 2,
        }).addTo(map);

        // Display the distance on the line
        const distance = turf.distance(turf.point([lng, lat]), turf.point([nearestPoint.lon, nearestPoint.lat]), { units: 'kilometers' });
        const midpoint = [(lat + nearestPoint.lat) / 2, (lng + nearestPoint.lon) / 2];
        L.marker(midpoint, {
          icon: L.divIcon({
            className: 'distance-label',
            html: `<div style="background: white; padding: 2px; border-radius: 3px; font-size: 12px;">${distance.toFixed(2)} km</div>`,
          }),
        }).addTo(map);

        alert(`Nearest road: ${road.tags.name || 'Unnamed road'}\nDistance: ${distance.toFixed(2)} km`);
        return; // Stop expanding the buffer
      }
    } catch (error) {
      console.error('Error querying Overpass API:', error);
      alert('Failed to fetch road data. Try again later.');
      return;
    }

    // Increment buffer size and retry
    bufferSize += 1;
  }

  alert('No road found within 100 km.');
}

// Main function to generate a random spot
function generateRandomSpot() {
  const country = getRandomCountry(); // Pick a random country
  randomPoint = getRandomPointInCountry(country); // Generate a random point

  // Clear existing layers
  map.eachLayer((layer) => {
    if (layer instanceof L.Marker || layer instanceof L.Circle || layer instanceof L.Polyline) {
      map.removeLayer(layer);
    }
  });

  // Highlight the selected country
  const countryLayer = L.geoJSON(country, { style: { color: 'blue', weight: 2 } });
  countryLayer.addTo(map);

  // Zoom to the country bounds
  map.fitBounds(countryLayer.getBounds());

  // Add a marker for the random point
  L.marker(randomPoint)
    .addTo(map)
    .bindPopup(`Random Spot in ${country.properties.name}`)
    .openPopup();
}

// Attach event listeners to the buttons
document.getElementById('generate').addEventListener('click', generateRandomSpot);
document.getElementById('find-road').addEventListener('click', findClosestRoad);
