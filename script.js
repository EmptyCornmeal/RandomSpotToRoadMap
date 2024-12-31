const map = L.map('map').setView([20, 0], 2); // Default world view

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

let countries; // Store GeoJSON features
let randomPoint; // Store the random point

// Load GeoJSON and populate dropdown
fetch('https://raw.githubusercontent.com/EmptyCornmeal/RandomSpotToRoadMap/main/world-administrative-boundaries.geojson')
  .then(response => response.json())
  .then(data => {
    countries = data.features; // Save countries globally
    L.geoJSON(data).addTo(map); // Add all countries to the map
    populateCountryDropdown(); // Populate dropdown with country names
  });

// Populate the dropdown menu with country names
function populateCountryDropdown() {
  const dropdown = document.getElementById('countryDropdown');
  countries.forEach(country => {
    const option = document.createElement('option');
    option.value = country.properties.name; // Adjust to match the property for the country name
    option.textContent = country.properties.name;
    dropdown.appendChild(option);
  });
}

// Calculate bounding box for a feature
function calculateBBox(feature) {
  const coordinates = feature.geometry.coordinates.flat(Infinity); // Handle deeply nested arrays
  const lngs = coordinates.filter((_, i) => i % 2 === 0); // Extract longitudes
  const lats = coordinates.filter((_, i) => i % 2 !== 0); // Extract latitudes
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
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
          ? country.geometry.coordinates.some(polygon =>
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

// Main function to generate a random spot
function generateRandomSpot() {
  const dropdown = document.getElementById('countryDropdown');
  const selectedCountryName = dropdown.value;

  if (!selectedCountryName) {
    alert('Please select a country!');
    return;
  }

  // Find the selected country by name
  const selectedCountry = countries.find(
    country => country.properties.name === selectedCountryName
  );

  if (!selectedCountry) {
    alert('Country not found in GeoJSON data.');
    return;
  }

  randomPoint = getRandomPointInCountry(selectedCountry); // Generate a random point

  // Clear existing non-GeoJSON layers (like markers, circles, and polylines)
  map.eachLayer(layer => {
    if (!(layer instanceof L.TileLayer) && !(layer instanceof L.GeoJSON)) {
      map.removeLayer(layer);
    }
  });

  // Highlight the selected country
  const countryLayer = L.geoJSON(selectedCountry, { style: { color: 'blue', weight: 2 } });
  countryLayer.addTo(map);

  // Zoom to the country bounds
  map.fitBounds(countryLayer.getBounds());

  // Add a marker for the random point with coordinates in the popup
  const [lat, lng] = randomPoint;
  L.marker(randomPoint)
    .addTo(map)
    .bindPopup(`Random Spot in ${selectedCountryName} at (${lat.toFixed(5)}, ${lng.toFixed(5)})`)
    .openPopup();
}

// Event Listener
document.getElementById('generate').addEventListener('click', generateRandomSpot);
