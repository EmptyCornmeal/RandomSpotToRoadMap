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
fetch('https://raw.githubusercontent.com/EmptyCornmeal/RandomSpotToRoadMap/main/world-administrative-boundaries.geojson')
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
      throw error;
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

  // Draw a buffer circle around the random point
  if (bufferCircle) {
    map.removeLayer(bufferCircle);
  }
  bufferCircle = L.circle(randomPoint, {
    radius: 5000, // 5 km buffer
    color: 'red',
    fillOpacity: 0.2,
  }).addTo(map);

  map.fitBounds(bufferCircle.getBounds()); // Zoom to the buffer

  // Query Overpass API for roads within 5 km
  const overpassUrl = `https://overpass-api.de/api/interpreter?data=[out:json];way["highway"](around:5000,${lat},${lng});out geom;`;

  try {
    const response = await fetch(overpassUrl);
    const data = await response.json();

    if (data.elements.length > 0) {
      const road = data.elements[0];
      const roadCoordinates = road.geometry.map((point) => [point.lat, point.lon]);

      // Add the road to the map
      if (roadLayer) map.removeLayer(roadLayer);
      roadLayer = L.polyline(roadCoordinates, { color: 'blue', weight: 4 }).addTo(map);

      const nearestPoint = road.geometry.reduce((closest, point) => {
        const distance = turf.distance(turf.point([lng, lat]), turf.point([point.lon, point.lat]));
        return distance < closest.distance ? { point, distance } : closest;
      }, { distance: Infinity }).point;

      // Draw a line between the random point and the nearest point on the road
      if (connectionLine) map.removeLayer(connectionLine);
      connectionLine = L.polyline([[lat, lng], [nearestPoint.lat, nearestPoint.lon]], {
        color: 'green',
        weight: 2,
      }).addTo(map);

      const distance = turf.distance(turf.point([lng, lat]), turf.point([nearestPoint.lon, nearestPoint.lat]), { units: 'kilometers' });
      alert(`Found road ${road.tags.name || "Unnamed"} at ${distance.toFixed(2)}km`);
    }
  } catch (error) {
    alert('No roads found nearby.');
  }
}

// Main function to generate a random spot
function generateRandomSpot() {
  const country = getRandomCountry(); // Pick a random country
  randomPoint = getRandomPointInCountry(country);

  map.eachLayer((layer) => {
    if (layer instanceof L.Marker || layer instanceof L.Circle || layer instanceof L.Polyline) {
      map.removeLayer(layer);
    }
  });

  // Add marker and zoom to country
  L.marker(randomPoint).addTo(map).bindPopup(`Random Spot`).openPopup();
}

// Event Listeners
document.getElementById('generate').addEventListener('click', generateRandomSpot);
document.getElementById('find-road').addEventListener('click', findClosestRoad);
